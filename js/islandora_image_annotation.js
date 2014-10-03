/*jslint browser: true*/
/*global jQuery, Drupal, RDF, IIAUtils*/
/**
 * @file
 * Core class acts as a central store of annotations.
 *
 * Makes use of the jQuery RDF plugin, which we seem to have a later version 1.1
 * in which no one else in the world has...
 * @see https://code.google.com/p/rdfquery/
 */
(function ($) {
  'use strict';

  /**
   * The DOM element that represents the Singleton Instance of this class.
   * @type {string}
   */
  var base = '#islandora-image-annotation';

  /**
   * Initialize the Create Annotation Dialog Box.
   *
   * We can only have one Create Annotation Dialog Box per page.
   */
  Drupal.behaviors.islandoraImageAnnotation = {
    attach: function (context, settings) {
      if (Drupal.IslandoraImageAnnotation[base] === undefined) {
        $(base, document).once('islandoraImageAnnotation', function () {
          Drupal.IslandoraImageAnnotation[base] = new Drupal.IslandoraImageAnnotation(base, settings.islandoraImageAnnotation);
        });
      }
    }
  };

  /**
   * Creates an instances of the Islandora Image Annotation Widget.
   *
   * @param {string} base
   *   The element ID that this class is bound to.
   * @param {object} settings
   *   Drupal.settings for this object widget.
   * @param {string} settings.manifestUrl
   *   The url to the manifest document.
   *
   * @constructor
   */
  Drupal.IslandoraImageAnnotation = function (base, settings) {
    // Private Members.
    var that, rdf, fetched, annotations;

    // Reference to this object for use in private functions, that might be
    // called from a different scope.
    that = this;

    // Acts as a triple-store / databank.
    rdf = $.rdf({
      base: 'http://localhost/EmicShared/impl/',
      namespaces: {
        dc: 'http://purl.org/dc/elements/1.1/',
        dcterms: 'http://purl.org/dc/terms/',
        dctype: 'http://purl.org/dc/dcmitype/',
        oa: 'http://www.w3.org/ns/openannotation/core/',
        cnt: 'http://www.w3.org/2008/content#',
        dms: 'http://dms.stanford.edu/ns/',
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        ore: 'http://www.openarchives.org/ore/terms/',
        exif: 'http://www.w3.org/2003/12/exif/ns#'
      }
    });

    // Keep track of all external resources we have fetched triples from so that
    // we don't make any more requests than we need to.
    fetched = [];

    // A list of all of the processed annotations, grouped by type.
    annotations =  {
      text: {},
      audio: {},
      image: {},
      comment: {},
      zone: {}
    };

    /**
     * Creates a full URL to the site with the given path.
     *
     * @param {string} path
     * @returns {string}
     */
    function url(path) {
      var origin;
      // Handle IE missing feature.
      if (!window.location.origin) {
        origin = window.location.protocol + "//" + window.location.hostname;
        origin += (window.location.port ? ':' + window.location.port : '');
      } else {
        origin = window.location.origin;
      }
      return origin + Drupal.settings.basePath + path;
    }

    /**
     * Take RDF Resource and convert its RDF list to a javascript array.
     *
     * @see http://www.w3.org/TR/rdf-schema/#ch_collectionvocab
     *
     * @param resource
     *   An $.rdf object that "contains" the list we will fetch.
     *
     * @returns {Array}
     *   The RDF list as a javascript array of $.rdf resources.
     */
    function rdfListToArray(resource) {
      var list, firsts, rests, next;
      list = [];
      firsts = {};
      rests = {};

      // Fetch all collection style triples, even if we are not interested in
      // them.
      rdf.where('?what rdf:first ?first')
        .where('?what rdf:rest ?rest')
        .each(function () {
          firsts[this.what.value] = this.first.value;
          rests[this.what.value] = this.rest.value;
        });

      // Start the list from the given resources first list item.
      list.push(firsts[resource]);
      next = rests[resource];

      // Iterate through linked list.
      while (next) {
        if (firsts[next] !== undefined) {
          list.push(firsts[next]);
        }
        next = rests[next];
      }
      return list;
    }

    /**
     * Gets the URI to the given Aggregation's Resource Map.
     *
     * @see http://www.openarchives.org/ore/terms/
     * @see https://code.google.com/p/rdfquery/
     *
     * @param {object|string} aggregation
     *   Either the URI representing the aggregation or an $.rdf object
     *   representing the aggregation.
     *
     * @returns {string}
     *   The URI of the Resource Map if found.
     */
    function getAggregationResourceMapURI(aggregation) {
      var resourceMapURI = '';
      rdf.reset();
      rdf.where('<' + aggregation.toString() + '> ore:isDescribedBy ?resourceMap')
        .where('?resourceMap dc:format "application/rdf+xml"')
        .each(function () {
          resourceMapURI = this.resourceMap.value.toString();
        });
      return resourceMapURI;
    }

    /**
     * Pull rdf/xml file and parse to triples with rdfQuery.
     *
     * @param {string} url
     *   The uri to fetch the triples from.
     * @param {function} callback
     *   The callback to execute upon success, it's expected to take the given
     *   $.rdf object as it's first parameter, and the uri as it's second.
     */
    function fetchTriples(url, callback) {
      // Store that we've fetched this URI to prevent duplicate requests.
      fetched.push(url);
      $.ajax({
        type: 'GET',
        async: true,
        url: url,
        success: function (data) {
          try {
            rdf.databank.load(data);
            callback(url);
          } catch (exception) {
            console.log('Broken RDF/XML: ' + exception);
            console.log(exception.stack);
          }
        },
        error:  function (XMLHttpRequest, status, errorThrown) {
          console.log('Can not fetch any data from ' + url + ': ' + errorThrown);
        }
      });
    }

    /**
     * Given a Resource Map, fetch the Aggregation's resources and their order.
     *
     * @param {object|string} resourceMap
     *   Either the URI representing the Resource Map or an $.rdf object
     *   representing the Resource Map.
     *
     * @returns {object}
     *   An associative array in which the key's denote the Aggregation's
     *   Resources, and the value is the order in which they were defined.
     */
    function getOrderOfAggregationResources(resourceMap) {
      var zorder = {}, aggregation = null;
      rdf.reset();
      rdf.where('<' + resourceMap + '> ore:describes ?aggregation')
        .each(function () {
          aggregation = this.aggregation.value.toString();
        });
      if (aggregation !== null) {
        $.each(rdfListToArray(aggregation), function (index, value) {
          zorder[value] = parseInt(index, 10) + 1;
        });
      }
      return zorder;
    }

    /**
     * Gets all of the annotation identifiers in the databank.
     *
     * @returns {[string]}
     *   The identifiers of the annotations.
     */
    function getAnnotationIdentifiers() {
      var identifiers = [];
      rdf.reset();
      rdf.where('?annotation oa:hasBody ?body')
        .each(function () {
          var annotation = this.annotation.value.toString();
          identifiers.push(annotation);
        });
      return identifiers;
    }

    /**
     * Gets annotation from the given identifier.
     *
     * @param {string} identifier
     *   The identifier used to look up the annotation object
     *
     * @returns {object|null}
     *   The annotation object if found, null otherwise.
     */
    function getAnnotation(identifier) {
      var result = null;
      $.each(annotations, function (type, typeAnnotations) {
        $.each(typeAnnotations, function (id, annotation) {
          if (identifier === id) {
            result = annotation;
            return false;
          }
        });
        return result === null;
      });
      return result;
    }

    /**
     * Gets a annotations of the give type if given otherwise all annotations.
     *
     * @returns {[RDF.Annotation]}
     *   Gets the annotations for the given.
     */
    function getUnprocessedAnnotations() {
      var identifiers = getAnnotationIdentifiers();
      // Filter out the annotations which have already been processed.
      identifiers = $.grep(identifiers, function (id) {
        return getAnnotation(id) === null;
      });
      return RDF.createAnnotations(IIAUtils.unique(identifiers), rdf.databank.dump());
    }

    /**
     * Process the annotations associated with the given aggregation.
     *
     * @param {string} uri
     *   The Resource Map URI for the annotations we are to process.
     */
    function processAnnotations(uri) {
      var unprocessedAnnotations, xmlFiles, zorder;

      unprocessedAnnotations = getUnprocessedAnnotations();
      zorder = (uri === undefined) ? {} : getOrderOfAggregationResources(uri);

      xmlFiles = {};
      $.each(unprocessedAnnotations, function (index, annotation) {
        var type, pid, canvas;
        type = annotation.getType();

        if (!type) {
          return;
        }

        // Update the zOrder of the annotation, as defined by the annotation's
        // manifest.
        if (zorder && zorder[annotation.id] !== undefined) {
          annotation.zOrder = zorder[annotation.id];
        }

        // Figure out which canvas.
        if (annotation.targets[0].partOf !== undefined) {
          canvas = annotation.targets[0].partOf.id;
        } else {
          canvas = annotation.targets[0].id;
        }

        // Type specific features:
        // 1) Fetch XML docs (eg TEI transcription).
        if (annotation.body.fragmentType === 'xml') {
          pid = annotation.body.partOf.id;
          // Need to fetch XML before painting.
          xmlFiles[pid] = (xmlFiles[pid] !== undefined) ? xmlFiles[pid] : [];
          xmlFiles[pid].push([annotation, annotation.body]);
          // Delay processed event until all document(s) are fetched.
          annotation.finished -= 1;
        }
        // 2) Fetch SVG doc if external.
        if (annotation.body.constraint !== undefined && !annotation.body.constraint.value) {
          pid = annotation.body.constraint.id;
          // Need to fetch XML before painting.
          xmlFiles[pid] = (xmlFiles[pid] !== undefined) ? xmlFiles[pid] : [];
          xmlFiles[pid].push([annotation, annotation.body.constraint]);
          // Delay processed event until all document(s) are fetched.
          annotation.finished -= 1;
        }

        // Cache all the processed annotations and group them by type and
        // canvas.
        IIAUtils.push(annotations[type], canvas, annotation);

        // If this annotation requires no further processing notify the world
        // it's been processed.
        if (annotation.finished) {
          that.trigger('processedAnnotation', annotation);
        }
      });

      // And launch AJAX queries for any external XML docs, each uri is based on
      // the annotations PID.
      $.each(xmlFiles, function (uri, annotations) {
        $.ajax({
          url: uri,
          dataType: 'xml',
          success: function (data) {
            // Update the body target value if it's found elsewhere.
            $.each(annotations, function (index, info) {
              var annotation, bodyTarget, selector, textSelection, text;
              annotation = info[0];
              bodyTarget = info[1];
              // Fetch the text content of the body.
              if (bodyTarget.fragmentType === 'xml') {
                selector = bodyTarget.fragmentInfo[0];
                textSelection = bodyTarget.fragmentInfo[1];
                if (textSelection) {
                  text = $(data).find(selector).text().substring(textSelection[0], textSelection[1]);
                } else {
                  text = $(data).find(selector); // leave it up to Paint to deal with.
                }
              } else {
                text = data;
              }
              bodyTarget.value = text;
              annotation.finished += 1;
              // If this annotation requires no further processing notify the
              // world it's been processed.
              if (annotation.finished) {
                that.trigger('processedAnnotation', annotation);
              }
            });
          },
          error: function () {
            console.log('Can not fetch data from ' + uri);
          }
        });
      });
    }

    /**
     * Processes the Given Sequence and extract a list of Canvases.
     *
     * @param {string} uri
     *   The Resource Map URI for the sequence we are to process.
     */
    function processSequence(uri) {
      var sequence;
      // Fetch the Aggregation for the Resource Map.
      rdf.where('?sequence rdf:type dms:Sequence')
        .where('?sequence ore:isDescribedBy <' + uri + '>')
        .each(function () {
          sequence = this.sequence.value;
        });
      // If we don't find one that matches the given Resource map, just grab the
      // first one.
      if (sequence === undefined) {
        rdf.where('?sequence rdf:type dms:Sequence')
          .each(function () {
            sequence = this.sequence.value;
          });
      }
      if (sequence !== undefined) {
        $.each(rdfListToArray(sequence), function (index, sequence) {
          that.trigger('processedSequence', sequence.toString());
        });
      }
    }

    /**
     * Processes the Manifest of other Aggregations of Resources.
     *
     * This function is responsible for populating this object with data about
     * the image and it's annotations.
     *
     * At the moment we only support / create image and comment annotations.
     *
     * @param {string} uri
     *   The Resource Map URI of the Manifest.
     */
    function processManifest(uri) {
      var sequences, aggregations, storeAggregation;

      // Build up the Sequences, typically only one NormalSequence.
      sequences = [];
      rdf.where('<' + uri + '> ore:describes ?aggregation')
        .where('?aggregation ore:aggregates ?sequence')
        .where('?sequence rdf:type dms:Sequence')
        .each(function () {
          sequences.push(this.sequence.value);
        });
      rdf.reset();

      // Fetch the Image Annotations, Text Annotations, Audio Annotations,
      // Zone Annotations, and Comment Annotations for this Aggregation.
      aggregations = {
        text: {
          '*': []
        },
        audio: {
          '*': []
        },
        image: {
          '*': []
        },
        comment: {
          '*': []
        },
        zone: {
          '*': []
        }
      };
      // Store the aggregation.
      storeAggregation = function (type) {
        return function () {
          var canvas, sequence;
          // '*' stands for those annotations which are not associated with a
          // specific canvas.
          canvas = (this.canvas === undefined) ? '*' : this.canvas.value;
          sequence = this.sequence.value;
          IIAUtils.push(aggregations[type], canvas, sequence);
        };
      };
      rdf.where('<' + uri + '> ore:describes ?aggregation')
        .where('?aggregation ore:aggregates ?sequence')
        .optional('?sequence dms:forCanvas ?canvas')
        .where('?sequence rdf:type dms:ImageAnnotationList')
        .each(storeAggregation('image')).end()
        .where('?sequence rdf:type dms:TextAnnotationList')
        .each(storeAggregation('text')).end()
        .where('?sequence rdf:type dms:AudioAnnotationList')
        .each(storeAggregation('audio')).end()
        .where('?sequence rdf:type dms:ZoneAnnotationList')
        .each(storeAggregation('zone')).end()
        .where('?sequence rdf:type dms:CommentAnnotationList')
        .each(storeAggregation('comment')).end();
      rdf.reset();

      // Process the Sequences, typically there will be only one NormalSequence.
      $.each(sequences, function (index, sequence) {
        fetchTriples(getAggregationResourceMapURI(sequence), processSequence);
      });
      // Process all of the Annotation Aggregations.
      $.each(aggregations, function (type, aggregations) {
        $.each(aggregations, function (canvas, aggreations) {
          $.each(aggreations, function (index, aggregation) {
            fetchTriples(getAggregationResourceMapURI(aggregation), processAnnotations);
          });
        });
      });
    }

    // @todo Remove.
    // Just some debug code.
    this.on('processedSequence processedAnnotation', function (event) {
      console.log(arguments);
    });

    // Manifest initialization, this will kick off the process of load all the
    // required data to render the image and it's annotations.
    fetchTriples(url('islandora/anno/serve/' + settings.pid + '/Manifest/manifest.xml'), processManifest);
  };

  /**
   * Execute all handlers and behaviors attached to the matched elements for the
   * given event type.
   *
   * @param {string} event
   *   A string containing a JavaScript event type, such as click or submit.
   * @param {Array|Object} extraParameters
   *   Additional parameters to pass along to the event handler.
   */
  Drupal.IslandoraImageAnnotation.prototype.trigger = function (event, extraParameters) {
    $(base).trigger(event, extraParameters);
  };

  /**
   * Registered callback for the given event.
   */
  Drupal.IslandoraImageAnnotation.prototype.on = function (event, callback) {
    $(base).on(event, callback);
  };

  /**
   * Unregistered callback for the given event.
   */
  Drupal.IslandoraImageAnnotation.prototype.off = function (event, callback) {
    $(base).off(event, callback);
  };

  /**
   * Gets the global singleton of this class.
   *
   * @return {IslandoraImageAnnotation}
   */
  Drupal.IslandoraImageAnnotation.getInstance = function () {
    return Drupal.IslandoraImageAnnotation[base];
  };

}(jQuery));
