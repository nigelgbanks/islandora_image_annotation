/*jslint browser: true*/
/*global jQuery, RDF*/
/**
 * @file
 * Defines the Islandora Image Annotation Canvas and it's Drupal behaviour.
 *
 * Makes use of the jQuery RDF plugin, which we seem to have a later version 1.1
 * in which no one else in the world has...
 * @see https://code.google.com/p/rdfquery/
 */
(function ($) {
  'use strict';

  /**
   * Initialize the Islandora Image Annotation Canvas.
   *
   * We can only have one canvas per page.
   */
  Drupal.behaviors.islandoraImageAnnotationCanvas = {
    attach: function (context, settings) {
      var base = '#islandora-image-annotation-canvas';
      $(base, context).once('islandoraImageAnnotation', function () {
        Drupal.IslandoraImageAnnotationCanvas[base] = new Drupal.IslandoraImageAnnotationCanvas(base, settings.islandoraImageAnnotationCanvas);
      });
    }
  };

  /**
   * Instantiate the Image Annotation Canvas.
   *
   * @param {string} base
   *   The id of the html element in which to bind the canvas to.
   *
   * @param {object} settings
   *   The Drupal.settings variable for this widget.
   *
   * @constructor
   */
  Drupal.IslandoraImageAnnotationCanvas = function (base, settings) {
    // Private Members.
    var that = this;

    // Set the default properties.
    $.extend(this, {
      'canvasWidth': 0,    // scaled width of canvas in pixels.
      'canvasHeight': 0,   // scaled height of canvas in pixels.
      // @todo remove this property.
      'numCanvases': 0,    // number of canvases to display.
      // @todo remove this property.
      'current': 0,        // current idx in sequence.
      'done': [],          // URLs already processed.
      'query': null,       // top level databank.
      'sequence': [],      // Sequence list.
      'sequenceInfo': {},  // uri to [h,w,title].
      'annotations': {
        'image': {},
        'text': {},
        'audio': {},
        'zone': {},
        'comment': {}
      },
      'lists': {
        'image': {},
        'text': {},
        'audio': {},
        'zone': {},
        'comment': {}
      },
      'raphaels': {
        'image': {},
        'text': {},
        'audio': {},
        'zone': {},
        'comment': {}
      },
      'zOrders': {
        'image': 1,
        'detailImage': 1000,
        'text': 2000,
        'audio': 3000,
        'zone': 4000,
        'comment': 5000
      },
      'canvasDivHash': {},
      'builtAnnos': [],
      'paintedAnnos': [],
      'audioAnno': null,
      'waitingXHR': 0,
      opts: {
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
      }
    });

    /**
     * Initializes the canvas.
     */
    function initializeCanvas() {
      var $canvasBody, $canvas;
      $canvasBody = $('#canvas-body');
      that.canvasWidth = $canvasBody.width();
      that.canvasHeight = $canvasBody.height();
      that.numCanvases = 1;
      if ($('#canvas', $canvasBody).length === 0) {
        $('#canvases').append('<div id="canvas" class="canvas" />');
      }
      $canvas = $('#canvas');
      $canvas.width(that.canvasWidth);
      $canvas.height(that.canvasHeight);
    }

    /**
     * Resize the canvas and the image inside of it.
     */
    function resizeCanvas() {
      var $imageWrapper, $image, width;

      $imageWrapper = $('.base_img');
      $image = $imageWrapper.children(":first");
      width = $('#canvas-body').width();

      $image.width(width);
      $image.css('height', 'auto');
      $imageWrapper.css('height', $image.height());
      initializeCanvas();
    }

    /**
     * Sets up the user interface.
     */
    function initializeUI() {
      var poll = (function () {
        var timer = 0;
        return function (callback, milliseconds) {
          clearTimeout(timer);
          timer = setTimeout(callback, milliseconds);
        };
      }());
      $(window).resize(function () {
        // Poll the window.resize event every 300ms for changes and resize the
        // canvas appropriately.
        poll(function () {
          resizeCanvas();
        }, 300);
      });
    }

    /**
     * Creates the base RDF object which will act as a triple-store / databank.
     *
     * @return {object}
     *   The $.rdf object used to fetch / process the annotations as triples.
     */
    function createRDFBase() {
      return $.rdf(that.opts);
    }

    /**
     * Pull rdf/xml file and parse to triples with rdfQuery.
     *
     * @param {string} uri
     *   The uri to fetch the triples from.
     * @param {object} rdf
     *   The $.rdf object in which the triples are loaded into.
     * @param {function} callback
     *   The callback to execute upon success, it's expected to take the given
     *   $.rdf object as it's first parameter, and the uri as it's second.
     */
    function fetchTriples(uri, rdf, callback) {
      // Store that we've fetched this URI to prevent duplicate requests.
      that.done.push(uri);
      $.ajax({
        type: 'GET',
        async: false,
        url: uri,
        success: function (data, status, xhr) {
          try {
            rdf.databank.load(data);
            if (rdf !== null) {
              callback(rdf, uri);
            }
          } catch (exception) {
            console.log('Broken RDF/XML: ' + exception);
            console.log(exception.stack);
          }
        },
        error:  function (XMLHttpRequest, status, errorThrown) {
          console.log('Can not fetch any data from ' + uri + ': ' + errorThrown);
        }
      });
    }

    /**
     * Take RDF Resource and convert its RDF list to a javascript array.
     *
     * @see http://www.w3.org/TR/rdf-schema/#ch_collectionvocab
     *
     * @param {object} rdf
     *   The $.rdf object whose triple store is used to query for the
     *   list triples.
     * @param resource
     *   An $.rdf object that "contains" the list we will fetch.
     *
     * @returns {Array}
     *   The RDF list as a javascript array of $.rdf resources.
     */
    function rdfListToArray(rdf, resource) {
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
     * Constructs RDF.Annotation objects for the given annotations identifiers.
     *
     * @todo Not sure if it's significant but if this function is called
     * multiple times, it won't return the same values due to the caching
     * nonsense that doesn't return the cached object here just doesn't create
     * one. Probably a bug.
     *
     * @param {[]} annotations
     *   An array of all the annotation identifiers.
     * @param {object} dump
     *   A dump of triples from the $.rdf objects databank.
     *
     * @returns {[RDF.Annotation]}
     *   An array of RDF.Annotation objects, representing the annotations given
     *   to this function.
     */
    function createRDFAnnotationObjects(annotations, dump) {
      // Pre-built annotations are cached so no need to build them again.
      var newAnnotations = $.grep(annotations, function (id) {
        return that.builtAnnos.indexOf(id) === -1;
      });
      // Foreach annotation id build an annotation object.
      return $.map(newAnnotations, function (id) {
        // Cache that we have build this annotation.
        that.builtAnnos.push(id);
        return new RDF.Annotation(id, dump);
      });
    }

    /**
     * Gets a annotations.
     *
     * @param {object} rdf
     *   The $.rdf object whose triple store is used to query for the
     *   annotations.
     * @param {string} [type]
     *   Type to filter the annotations by, if not provided all annotations will
     *   be returned regardless of type.
     *
     * @returns {[RDF.Annotation]}
     *   Gets the annotations for the given.
     */
    function getAnnotations(rdf, type) {
      var annotations = [];
      rdf.reset();
      // Filter by type
      if (type !== undefined) {
        rdf.where('?annotation a ' + type);
      }
      rdf.where('?annotation oa:hasBody ?body')
        .each(function () {
          var annotation = this.annotation.value.toString();
          annotations.push(annotation);
        });
      rdf.reset();
      return createRDFAnnotationObjects(IIAUtils.unique(annotations), rdf.databank.dump());
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
     * @param {object} rdf
     *   The $.rdf object whose triple store is used to query for the
     *   aggregations Resource Map.
     *
     * @returns {string}
     *   The URI of the Resource Map if found.
     */
    function getAggregationResourceMapURI(aggregation, rdf) {
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
     * Given a Resource Map, fetch the Aggregation's resources and their order.
     *
     * @param {object} rdf
     *   The $.rdf object whose triple store is used to query for the
     *   Resource Map's Aggregation, and it's Resources.
     * @param {object|string} resourceMap
     *   Either the URI representing the Resource Map or an $.rdf object
     *   representing the Resource Map.
     *
     * @returns {object}
     *   An associative array in which the key's denote the Aggregation's
     *   Resources, and the value is the order in which they were defined.
     */
    function getOrderOfAggregationResource(rdf, resourceMap) {
      var zorder = {}, aggregation = null;
      resourceMap = resourceMap.toString();
      rdf.reset();
      rdf.where('<' + resourceMap + '> ore:describes ?aggregation')
        .each(function () {
          aggregation = this.aggregation.value.toString();
        });
      if (aggregation !== null) {
        $.each(rdfListToArray(rdf, aggregation), function (index, value) {
          zorder[value] = parseInt(index, 10) + 1;
        });
      }
      return zorder;
    }

    /**
     * Gets the type of the given annotation.
     *
     * @param {object} annotation
     *   The annotation to get the type of.
     *
     * @returns {string|null}
     *   The annotation type, either (image, text, audio, comment, zone), or
     *   null if it could not be determined.
     */
    function getAnnotationType(annotation) {
      var annotationType = null;
      // Annotations can have multiple type values, so we first check for the
      // most generic description and then refine if possible.
      if ($.inArray('http://www.w3.org/ns/openannotation/core/Annotation', annotation.types)) {
        annotationType = 'comment';
      }
      // Check the more specific Annotations Types.
      $.each(annotation.types, function (index, type) {
        var types = {
          'http://dms.stanford.edu/ns/ImageAnnotation': 'image',
          'http://dms.stanford.edu/ns/TextAnnotation': 'text',
          'http://dms.stanford.edu/ns/AudioAnnotation': 'audio',
          'http://dms.stanford.edu/ns/CommentAnnotation': 'comment',
          'http://dms.stanford.edu/ns/ZoneAnnotation': 'zone'
        };
        if (types[type] !== undefined) {
          annotationType = types[type];
          return false;
        }
      });
      if (!annotationType) {
        // Check body type
        $.each(annotation.body.types, function (index, type) {
          var types = {
            'http://purl.org/dc/dcmitype/Image': 'image',
            'http://purl.org/dc/dcmitype/Text': 'text',
            'http://dms.stanford.edu/ns/ImageBody': 'audio',
            'http://dms.stanford.edu/ns/TextBody': 'comment',
            'http://dms.stanford.edu/ns/ImageSegment': 'zone'
          };
          if (types[type] !== undefined) {
            annotationType = types[type];
            return false;
          }
        });
      }
      if (!annotationType) {
        // Check body fragment type
        annotationType = annotation.body.fragmentType;
      }
      return annotationType;
    }

    /**
     * @todo Implement
     * @todo was paint_annos
     */
    function drawAnnotations() {
      // Step through all displayed canvases and paint all finished, unpainted
      // annotations. Do it this way as can't predict when annotations will be
      // available due to different AJAX speeds?
      // @todo is this shit true?
      $.each(that.canvasDivHash, function (canvas, div) {
        $.each(that.annotations, function (type, annotations) {
          $.each(annotations[canvas], function (index, annotation) {
            if (annotation.finished && that.paintedAnnos.indexOf(annotation.id) === -1) {
              that.paintedAnnos.push(annotation.id);
              drawAnnotation(type, annotation, div);
            }
          });
        });
      });
    }

    /**
     * @todo Implement
     * @todo was paint_anno
     */
    function drawAnnotation(type, annotation, div) {
      // @todo Implement this other crap.
      switch (type) {
      case 'image':
        drawImageAnnotation(annotation, div);
        break;
      case 'text':
        drawTextAnnotation(annotation, div);
        break;
      case 'audio':
        drawAudioAnnotation(annotation, div);
        break;
      case 'comment':
        drawCommentAnnotation(annotation, div);
        break;
      }
    }

    /**
     * Draw the given annotation on the given canvas element.
     *
     * @param {object} annotation
     *   The annotation to draw.
     * @param canvasId
     *   The DOM element ID for the canvas.
     */
    function drawImageAnnotation(annotation, canvasId) {
      var $image;
      var canvas, canvasWidth, canvasHeight, canvasTitle, scale, scaledHeight, scaledWidth,
        img, myid, aid, html, xywh, zprb, zprs, zpr, imge, imguri, imgid,
        x, y, w, h, tx, ty, tw, th, chkd, a, attr, body, clip, clipScale, cpe,
        div, divh, divw, doc, fullImage, imgh, imgoffleft, imgofftop,
        imgw, imhw, npth, offset, pth, pthelm, r, sc, svg, svgcanvas, target,
        ttlh, ttlw, zIdx, o, iopt;

      canvas = $('#' + canvasId).attr('canvas');
      canvasHeight = that.sequenceInfo[canvas][0];
      canvasWidth = that.sequenceInfo[canvas][1];
      scale = that.canvasWidth / canvasWidth;
      scaledHeight = scale * canvasHeight;
      scaledWidth = scale * canvasWidth;

      // @todo clean up this shite.
      if (annotation.id.substring(0, 9) === 'urn:uuid:') {
        myid = 'imganno_' + annotation.id.substring(9, 1000);
      } else {
        aid = annotation.id.substring(8, 1000)
        aid = aid.replace(/\./g, '_');
        aid = aid.replace(/\//g, '_');
        aid = aid.replace(/-/g, '_');
        myid = 'imganno_' + aid;
      }

      // First find which image to use!
      // @todo Could be a function of it's own, in the RDF object.
      img = null;
      if (annotation.body.options.length > 0) {
        // Display choice with best default
        annotation.body.options.sort(function (a, b) {
          return a.id > b.id ? 1 : -1;
        });
        img = annotation.body.defaultOpt || annotation.body.options[0];
      } else {
        img = annotation.body;
      }

      // And Display it.
      xywh = img.getRect();
      if (xywh !== null) {
        x = xywh[0];
        y = xywh[1];
        w = xywh[2];
        h = xywh[3];
      }

      if (img.rotation === 0 && annotation.targets[0].partOf === null && img.partOf === null) {
        // Full Image annotates Full Canvas
        imgid = 'img_' + myid;
        imguri = img.id;

        $image = $('<div />', {
          id: myid
        }).append($('<img />', {
          id: imgid,
          src: imguri
        }));
        $("#annotations").append($image);
        div = $('#' + myid);
        div.position({
          'of': '#' + canvasId,
          'my': 'left top',
          'at': 'left top',
          'collision': 'none',
          'offset': '0 0'
        });
        imge = $('.base_img').children("img:first");

        imge.width(scaledWidth);
        imge.height(scaledHeight);
        //div.width(sw)
        div.height(scaledHeight);
        div.css('z-index', that.zOrders.image);
      } else if (img.rotation === 0 && (xywh !== null || !img.partOf)) {

        // Full Image/Rect Segment annotates Rect Segment of Canvas
        // Can get by with just regular HTML and CSS

        if (img.partOf === null) {
          imguri = annotation.body.id;
          clip = '';

        } else {
          imguri = img.partOf.id;
          // top, right, bottom, left offsets from edges == STUPID!
          // Clip needs to be scaled against size of full image

          ttlh = 1088;
          ttlw = 816;

          clipScale = scaledWidth / w;
          imgh = ttlh * clipScale;
          imhw = ttlw * clipScale;

          clip = 'rect('+(y * clipScale)+'px,'+((x + w)*clipScale)+'px,'+((y+h)*clipScale)+'px,'+(x*clipScale)+'px)';
          zIdx = topinfo['zOrders']['image'] + annotation.zOrder;
          divh = scaledHeight;
          divw = scaledWidth;
          offset = "0 0"
          imgoffleft = (x*clipScale);
          imgofftop = (y*clipScale);
        }

        xywh = annotation.targets[0].getRect();
        if (xywh != null) {
          tx = xywh[0];
          ty = xywh[1];
          tw = xywh[2];
          th = xywh[3];
          offset = "" + Math.floor(tx*scale) + ' ' + Math.floor(ty*scale);
          zIdx = topinfo['zOrders']['detailImage'] + annotation.zOrder;
          divw = tw * scale;
          divh = th * scale;
        }

        body = '<img src="'+ imguri +'" id="img_'+ myid +'"/>';
        $("#annotations").append('<div class="img_anno" id="' + myid + '" >'
          + body + '</div>');
        div = $('#' + myid);
        div.css('z-index', zIdx);
        div.height(divh);

        img = $('#img_' + myid);

        if (clip) {
          img.css('position', 'absolute');
          img.offset({
            top:div.position().top - imgofftop,
            left:div.position().left-imgoffleft
          });
          img.css('clip', clip);
        }
        img.height(imgh);
        img.width(imgw);

        div.position({
          'of':'#'+canvasId,
          'my':'left top',
          'at':'left top',
          'collision':'none',
          'offset': offset
        });

      } else if (img.rotation && annotation.targets[0].partOf == null) {
        // Rotated image targets entire canvas.
        // No need to clip, just translate top corner to correct place
        // and then scale to correct size. Non visible stuff will be outside SVG
        // view port and thus not display.

        fullImage = img.partOf;
        svgcanvas = mk_raphael('image', canvas, canvasId);
        r = img.fragmentInfo;
        x = svgcanvas.image(fullImage.id, 0, 0, fullImage.width, fullImage.height);
        x.node.setAttribute('preserveAspectRatio', 'none');

        x.rotate(img.rotation,r[0],r[1]);
        if (img.rotation == 90) {
          x.translate(r[3]-r[0], 0-r[1])
        } else {
          x.translate(0-r[0],r[2]-r[1])
        }
      } else {
        // Non Rect Segment of Image annotates (Canvas / Segment of Canvas)
        // Use SVG clip, either from SVG or media fragment
        // OR full image that needs rotation
        // XXX This cannot be unshown, and re-orders all together as just one SVG canvas

        fullImage = img.partOf;
        svgcanvas = mk_raphael('image', canvas, canvasId);

        // reset z-index to detail
        $(svgcanvas.wrapperElem).css('z-index', topinfo['zOrders']['detailImage']);
        target = annotation.targets[0];
        if (img.constraint != null) {
          svg = img.constraint.value;
        } else if (img.fragmentType == 'rect') {
          // Construct SVG rect from fragmentInfo
          r = img.fragmentInfo;
          svg = "<rect xmlns='"+SVG_NS+"' x='"+r[0]+"' y='"+r[1]+"' width='"+r[2]+"' height='"+r[3]+"'/>";
        }

        pth = $.parseXML(svg);
        doc = $(pth);
        pthelm = doc.children()[0];
        // Duplicating into the DOM for webkit
        npth = document.createElementNS(SVG_NS, pthelm.nodeName);
        for (a in pthelm.attributes) {
          attr = pthelm.attributes[a];
          npth.setAttribute(attr.nodeName, attr.nodeValue);
        }
        pthelm = npth;

        // Now determine if target is full canvas or fragment

        if (target.fragmentType == 'rect') {
          tx = target.fragmentInfo[0];
          ty = target.fragmentInfo[1];
          tw = target.fragmentInfo[2];
          th = target.fragmentInfo[3];
        } else {
          tw = canvasWidth;
          th = canvasHeight;
          tx = 0;
          ty = 0;
        }

        sc = th / fullImage.height;

        // And build SVG clip path.
        cpe = document.createElementNS(SVG_NS, 'clipPath');
        cpe.setAttribute('id', 'svgclippath' + canvasId);
        // Need to translate and scale the path as well as the image
        pthelm.setAttribute('transform', 'translate(' + tx + ' ' + ty + ') scale(' + sc + ')');

        cpe.appendChild(pthelm);
        svgcanvas.canvas.appendChild(cpe);

        x = svgcanvas.image(fullImage.id, 0, 0, fullImage.width, fullImage.height);
        x.node.setAttribute('preserveAspectRatio', 'none');
        x.node.setAttribute('clip-path', 'url(#svgclippath' + canvasId + ')');
        x.scale(sc, sc, 0, 0);
        x.translate(tx, ty);
      }
    }

    /**
     * @todo Document
     *
     * @param {object} rdf
     *   The $.rdf object whose triple store contains the Annotations.
     * @param {string} uri
     *   The Resource Map URI for the sequence we are to process.
     */
    function processAnnotations(rdf, uri) {
      var pid, allAnnotations, annotations, xmlFiles, zorder;

      allAnnotations = that.annotations;
      zorder = (uri === undefined) ? {} : getOrderOfAggregationResource(rdf, uri);

      try {
        annotations = getAnnotations(rdf);
      } catch (exception) {
        console.log('Error building annotations: ' + exception);
        console.log(exception.stack);
      } finally {
        // Try to force GC on the query.
        delete rdf.databank;
        rdf = null;
      }

      xmlFiles = {};
      $.each(annotations, function (index, annotation) {
        var type, canvas;
        type = getAnnotationType(annotation);

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
          annotation.finished -= 1;
        }
        // 2) Fetch SVG doc if external.
        if (annotation.body.constraint !== undefined && !annotation.body.constraint.value) {
          pid = annotation.body.constraint.id;
          // Need to fetch XML before painting.
          xmlFiles[pid] = (xmlFiles[pid] !== undefined) ? xmlFiles[pid] : [];
          xmlFiles[pid].push([annotation, annotation.body.constraint]);
          annotation.finished -= 1;
        }

        // Cache all the processed annotations and group them by type and
        // canvas.
        if (allAnnotations[type][canvas] === undefined) {
          allAnnotations[type][canvas] = [];
        }
        allAnnotations[type][canvas].push(annotation);
      });

      drawAnnotations();

      // And launch AJAX queries for any external XML docs, each uri is based on
      // the annotations PID.
      $.each(xmlFiles, function (uri, annotations) {
        $.ajax({
          url: uri,
          dataType: "xml",
          success: function (data, status, xhr) {
            $.each(annotations, function (index, info) {
              var annotation, bodyTarget, selector, textSelection, text;
              annotation = info[0];
              bodyTarget = info[1];
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
            });
            drawAnnotations();
          },
          error:  function(XMLHttpRequest, status, errorThrown) {
            console.log('Can not fetch data from ' + uri);
          }
        });
      });
    }

    /**
     * Fetch the annotations for the given type and draw them on the canvas.
     *
     * @param type
     *   The type of annotation expected to be 'text', 'image', 'audio',
     *   'comment', 'zone'.
     * @param canvas
     *   The Canvas to draw onto.
     */
    function fetchAnnotations(type, canvas) {
      var rdf, aggregations;
      // First look for annotations specific to the given canvas.
      aggregations = that.lists[type][canvas];
      if (aggregations === undefined) {
        // If we can't find any specific annotations render the ones which
        // are not associated with any canvas.
        aggregations = that.lists[type]['*'];
      }
      if (aggregations !== undefined && aggregations.length > 0) {
        // Create a new databank per file, and discard after extracting the
        // annotations.
        rdf = createRDFBase();
        $.each(aggregations, function (index, aggregation) {
          var resouceMapURI = getAggregationResourceMapURI(aggregation, that.query);
          if ($.inArray(resouceMapURI, that.done) !== -1) {
            drawAnnotations(type, canvas);
            return;
          }
          fetchTriples(resouceMapURI, rdf, processAnnotations);
        });
      }
    }

    /**
     * Gets the dimensions and the title of the given Canvas.
     *
     * @param {object} rdf
     *   The $.rdf object whose triple store contains the Annotations.
     * @param {string} uri
     *   The Canvas URI.
     *
     * @returns {*[]}
     *  @todo Document
     */
    function extractCanvasSize(rdf, uri) {
      var height, width, title;
      height = width = 0;
      title = ''
      rdf.where('<' + uri + '> exif:height ?height')
        .where('<' + uri + '> exif:width ?width')
        .optional('<' + uri + '> dc:title ?title')
        .each(function () {
          height = this.height.value;
          width = this.width.value;
          if (this.title !== undefined) {
            title = this.title.value;
          }
        });
      return [height, width, title];
    }

    /**
     * Fetches All the annotations and displays them on the canvas.
     *
     * @todo Document.
     *
     * @param canvas
     * @param canvasId
     */
    function showCanvas(canvas, canvasId) {
      var height, width, scale;

      // Info for current canvas
      if (that.sequenceInfo[canvas] === undefined) {
        that.sequenceInfo[canvas] = extractCanvasSize(that.query, canvas);
      }
      height = that.sequenceInfo[canvas][0];
      width = that.sequenceInfo[canvas][1];
      scale = that.canvasWidth / width;
      $('#' + canvasId).height(height * scale);

      // Start sucking down annotations
      /* @todo Implement */
      fetchAnnotations('zone', canvas);
      fetchAnnotations('image', canvas);
      fetchAnnotations('text', canvas);
      fetchAnnotations('audio', canvas);
      fetchAnnotations('comment', canvas);
      //fetch_comment_annotations();
    }

    function showPage() {
      var canvas = that.sequence[0],
        canvasId = 'canvas';

      that.canvasDivHash.canvas = canvasId;
      $('#' + canvasId).attr('canvas', canvas);
      showCanvas(canvas, canvasId);
    }

    function showPages() {
      // Empty current display
      $(".canvas").empty();
      $('#svg_wrapper').empty();
      $('#annotations').empty();
      $('.canvasUri').remove();

      that.canvasDivHash = {};
      that.raphaels = {
        'image': {},
        'text': {},
        'audio': {},
        'zone': {},
        'comment': {}
      };
      that.paintedAnnos = [];

      // Initialize to first Canvas div
      that.currentCanvas = 0;
      showPage();
    }

    /**
     * Processes the Given Sequence and extract a list of Canvases.
     *
     * @param {object} rdf
     *   The $.rdf object whose triple store contains the Sequence, it is used
     *   to query for the aggregations Resource Map.
     * @param {string} uri
     *   The Resource Map URI for the sequence we are to process.
     */
    function processSequence(rdf, uri) {
      var sequence = null;

      // Fetch the Aggregation for the Resource Map.
      rdf.where('?sequence rdf:type dms:Sequence')
        .where('?sequence ore:isDescribedBy <' + uri + '>')
        .each(function () {
          sequence = this.sequence.value;
        });
      // If we don't find one that matches the given Resource map, just grab the
      // first one.
      if (sequence === null) {
        rdf.where('?sequence rdf:type dms:Sequence')
          .each(function () {
            sequence = this.sequence.value;
          });
      }
      if (sequence !== null) {
        that.sequence = rdfListToArray(rdf, sequence);
      } else {
        // Something has gone terribly wrong.
        console.log('Could not find the sequence.');
      }
      // @todo Refactor this code.
      showPages();
    }

    /**
     * Processes the Manifest of other Aggregations of Resources.
     *
     * This function is responsible for populating this object with data about
     * the image and it's annotations.
     *
     * @param {object} query
     *   The rdf object which includes the manifest, it is used to query the
     *   manifest for other information.
     *
     * @param {string} uri
     *   The Resource Map URI of the Manifest.
     */
    function processManifest(query, uri) {
      var sequences, ranges, textAnnotations, audioAnnotations,
        imageAnnotations, commentAnnotations, zoneAnnotations;
      // Initialize the variables, '*' stands for those annotations which don't
      // are not associated with a specific canvas.
      sequences = [];
      ranges = [];
      textAnnotations = {
        '*': []
      };
      audioAnnotations = {
        '*': []
      };
      imageAnnotations = {
        '*': []
      };
      commentAnnotations = {
        '*': []
      };
      zoneAnnotations = {
        '*': []
      };

      // Build up the Sequences, typically only one NormalSequence.
      query.where('<' + uri + '> ore:describes ?aggregation')
        .where('?aggregation ore:aggregates ?sequence')
        .where('?sequence rdf:type dms:Sequence')
        .each(function () {
          sequences.push(this.sequence.value);
        });
      query.reset();

      // Fetch the Image Annotations, Text Annotations, Audio Annotations,
      // Zone Annotations, and Comment Annotations for this Aggregation.
      query.where('<' + uri + '> ore:describes ?aggregation')
        .where('?aggregation ore:aggregates ?sequence')
        .optional('?sequence dms:forCanvas ?canvas')
        .where('?sequence rdf:type dms:ImageAnnotationList')
        .each(function () {
          var canvas = (this.canvas === undefined) ? '*' : this.canvas.value,
            sequence = this.sequence.value;
          if (canvas === '*') {
            imageAnnotations[canvas].push(sequence);
          } else if (imageAnnotations[canvas] === undefined) {
            imageAnnotations[canvas] = [sequence];
          } else {
            imageAnnotations[canvas].push(sequence);
          }
        })
        .end()
        .where('?sequence rdf:type dms:TextAnnotationList')
        .each(function () {
          var canvas = (this.canvas === undefined) ? '*' : this.canvas.value,
            sequence = this.sequence.value;
          if (canvas === '*') {
            textAnnotations[canvas].push(sequence);
          } else if (textAnnotations[canvas] === undefined) {
            textAnnotations[canvas] = [sequence];
          } else {
            textAnnotations[canvas].push(sequence);
          }
        })
        .end()
        .where('?sequence rdf:type dms:AudioAnnotationList')
        .each(function () {
          var canvas = (this.canvas === undefined) ? '*' : this.canvas.value,
            sequence = this.sequence.value;
          if (canvas === '*') {
            audioAnnotations[canvas].push(sequence);
          } else if (audioAnnotations[canvas] === undefined) {
            audioAnnotations[canvas] = [sequence];
          } else {
            audioAnnotations[canvas].push(sequence);
          }
        })
        .end()
        .where('?sequence rdf:type dms:ZoneAnnotationList')
        .each(function () {
          var canvas = (this.canvas === undefined) ? '*' : this.canvas.value,
            sequence = this.sequence.value;
          if (canvas === '*') {
            zoneAnnotations[canvas].push(sequence);
          } else if (zoneAnnotations[canvas] === undefined) {
            zoneAnnotations[canvas] = [sequence];
          } else {
            zoneAnnotations[canvas].push(sequence);
          }
        })
        .end()
        .where('?sequence rdf:type dms:CommentAnnotationList')
        .each(function () {
          var canvas = (this.canvas === undefined) ? '*' : this.canvas.value,
            sequence = this.sequence.value;
          if (canvas === '*') {
            commentAnnotations[canvas].push(sequence);
          } else if (commentAnnotations[canvas] === undefined) {
            commentAnnotations[canvas] = [sequence];
          } else {
            commentAnnotations[canvas].push(sequence);
          }
        });
      query.reset();

      // Build up the ranges.
      query.where('?sequence dcterms:hasPart ?rng')
        .where('?rng a dms:Range')
        .where('?rng dc:title ?title')
        .where('?rng rdf:first ?first')
        .each(function () {
          ranges.push([this.title.value, this.first.value]);
        });

      // Store all the results in this object.
      that.ranges = ranges;
      that.lists.text = textAnnotations;
      that.lists.image = imageAnnotations;
      that.lists.audio = audioAnnotations;
      that.lists.comment = commentAnnotations;
      that.lists.zone = zoneAnnotations;

      // Process the NormalSequence if found.
      if (sequences.length === 1) {
        fetchTriples(getAggregationResourceMapURI(sequences[0], query), query, processSequence);
      }
    }

    // Start up.
    initializeUI();
    initializeCanvas();

    // Manifest initialization, this will kick off the process of load all the
    // required data to render the image and it's annotations.
    this.query = createRDFBase();
    fetchTriples(settings.manifestUrl,
      this.query,
      processManifest);

    // Adjust the canvas size now that we've loaded everything.
    resizeCanvas();
  };

}(jQuery));
