/*jslint browser: true*/
/*global jQuery, RDF, Raphael, ScaleRaphael*/
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
   * The DOM element that represents the Singleton Instance of this class.
   * @type {string}
   */
  var base = '#islandora-image-annotation-canvas';

  /**
   * Initialize the Islandora Image Annotation Canvas.
   *
   * We can only have one canvas per page.
   */
  Drupal.behaviors.islandoraImageAnnotationCanvas = {
    attach: function (context, settings) {
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
      // @todo Remove this hard coded thing.
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
     * Gets the ID of the current canvas.
     *
     * @returns {string}
     *   The ID of the current canvas, typically something like this:
     *   http://example.com/islandora/object/PID/datastream/DSID/view/Canvas
     */
    this.getCurrentCanvas = function () {
      // Just grabs the first canvas, we only support one right now.
      return $('.canvas[canvas]', '#canvases').attr('canvas');
    };

    /**
     * Gets the current rendered shapes.
     *
     * @param canvas
     * @returns {Array|shapes|*}
     */
    this.getShapes = function (canvas) {
      return this.raphaels.comment[canvas].annotationBackground.shapes;
    };

    /**
     * Initializes the canvas.
     */
    function initializeCanvas() {
      var $canvasBody, $canvas;
      $canvasBody = $('#canvas-body');
      that.canvasWidth = $canvasBody.width();
      that.canvasHeight = $canvasBody.height();
      $canvas = $('#canvas');
      $canvas.width(that.canvasWidth);
      $canvas.height(that.canvasHeight);
      // Update Raphael if possible.
      $.each(that.raphaels, function (type, canvases) {
        $.each(canvases, function (id, canvas) {
          canvas.changeSize(that.canvasWidth, that.canvasHeight, false, false);
        });
      });
    }

    /**
     * Resize the canvas and the image inside of it.
     */
    this.resizeCanvas = function () {
      var width = $('#canvas-body').width();
      $('.image-annotation').each(function () {
        var $imageWrapper, $image;
        $imageWrapper = $(this);
        $image = $imageWrapper.children('img:first');
        $image.width(width);
        $image.css('height', 'auto');
        $imageWrapper.css('height', $image.height());
        // Needs to be set explicitly since absolute position elements
        // like the image are not in the normal document flow.
        $('#canvas-body').height($image.height());
      });
      initializeCanvas();
    };

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
          that.resizeCanvas();
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
      return $.rdf({
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
      width = 0;
      height = 0;
      title = '';
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
     * @todo Document.
     *
     * @param type
     * @param canvas
     * @param canvasId
     * @returns {Paper}
     */
    this.makeRaphael = function (type, canvas, canvasId) {
      var info, canvasWidth, canvasHeight, scale, scaledWidth, scaledHeight,
        svgId, $svg, svgCanvas;
      if (that.raphaels[type][canvas] !== undefined) {
        return that.raphaels[type][canvas];
      }
      info = that.sequenceInfo[canvas];
      if (info === undefined) {
        info = extractCanvasSize(that.query, canvas);
        that.sequenceInfo[canvas] = info;
      }
      canvasWidth = info[1];
      canvasHeight = info[0];
      scale = that.canvasWidth / canvasWidth;
      scaledHeight = canvasHeight * scale;
      scaledWidth = canvasWidth * scale;
      svgId = 'svg-annotation-' + type;

      $svg = $('<div />', {
        id: svgId,
        canvas: canvas
      });
      $('#svg-wrapper').append($svg);
      $svg.height(scaledHeight);
      $svg.width(scaledWidth);
      // Allow a base image at 1
      $svg.css('z-index', that.zOrders[type] + 1);
      // @todo Sort this shit out:  $svg.css('position', 'absolute');
      $svg.css('position', 'static');
      $svg.position({
        'of': '#' + canvasId,
        'my': 'left top',
        'at': 'left top',
        'collision': 'none'
      });

      svgCanvas = ScaleRaphael(svgId, canvasWidth, canvasHeight);
      svgCanvas.changeSize(scaledWidth, scaledHeight, false, false);
      if ($.browser.webkit) {
        svgCanvas.safari();
      }
      // Cache svgCanvas.
      that.raphaels[type][canvas] = svgCanvas;
      return svgCanvas;
    };

    /**
     * Creates the icon that is used to create the polygon.
     *
     * @param {Element} background
     *   The background Raphael Element in which the coordinates are in.
     * @param {Element} polygon
     *   The point on the polygon to show the grabber.
     * @param {number} x
     *   The x coordinate.
     * @param {number} y
     *   The y coordinate.
     *
     * @returns {Element}
     *  A circle used as icon to indicate the latest point on the polygon.
     */
    function makeGrabber(background, polygon, x, y) {
      var onEnd, onStart, move, radius, circle;

      // Start the drag event.
      onStart = function () {
        this.start = [this.attr("cx"), this.attr("cy")];
      };

      // End the drag event.
      onEnd = function () {
        if (background.creating === this.polygon && this.index() === 0) {
          background.creating = null;
          this.polygon.attr('path', this.polygon.attr('path') + 'Z');
        }
      };

      // Move the circle.
      move = function (dx, dy) {
        var path, index = this.index();
        dx = Math.floor(dx * background.invertedScale);
        dy = Math.floor(dy * background.invertedScale);
        this.attr({
          cx: this.start[0] + dx,
          cy: this.start[1] + dy
        });
        path = Raphael.parsePathString(this.polygon.attr("path"));
        path[index][1] = Math.floor(this.start[0] + dx);
        path[index][2] = Math.floor(this.start[1] + dy);
        this.polygon.attr('path', path);
      };

      radius = Math.floor(10 * background.invertedScale);
      circle = background.paper.circle(x, y, radius);
      circle.attr({
        fill: '#ffffff',
        opacity: 0.3,
        stroke: 'black',
        'stroke-width': 'none',
        'stroke-dasharray': '- '
      });
      circle.polygon = polygon;
      polygon.set.push(circle);
      circle.start = [x, y];
      circle.moveFn = move;
      circle.drag(move, onStart, onEnd);

      // Gets the grabbers "index" which correlates to the point in the "path"
      // it represents.
      circle.index = function () {
        var me, grabbers, index;
        me = this;
        index = -1;
        // Filter out the removed grabbers an polygon objects.
        grabbers = $.grep(this.polygon.set, function (element) {
          return element.type === 'circle';
        });
        $.each(grabbers, function (i, element) {
          if (me === element) {
            index = i;
            return false;
          }
        });
        return index;
      };

      // Double clicking on the "grabber" will remove it and the point in the
      // "path" it represents.
      circle.dblclick(function () {
        var path = Raphael.parsePathString(this.polygon.attr("path"));
        path.splice(this.index(), 1);
        // A Path must be two or more points, we must also account for the 'Z'
        // terminator point.
        if (path.length <= 2) {
          background.creating = null;
          this.polygon.set.remove();
        } else {
          // Update the polygon's path such that it no longer includes this
          // "grabber". Make sure the first element in the path is marked.
          path[0][0] = 'M';
          this.polygon.attr("path", path);
        }
        this.remove();
      });
      return circle;
    }

    /**
     * Creates a Polygon, by tracking clicks and drawing a path between them.
     *
     * @param {Element} background
     *   The background Raphael Element in which the coordinates are in.
     * @param {number} x
     *   The x coordinate.
     * @param {number} y
     *   The y coordinate.
     * @param {object} attributes
     *   HTML element attributes to apply to the polygon, like color or
     *   stroke-width.
     *
     * @returns {Element}
     *  The polygon as a Raphael Element.
     */
    function makePolygon(background, x, y, attributes) {
      var onStart, onEnd, move, resize, addPoint, outer, paper, group, grabber;
      // Start the drag event.
      onStart = function () {
        this.set.tmp = [0, 0];
      };

      // End the drag event.
      onEnd = function () {
        this.set.tmp = undefined;
      };

      // Move a 'node' on the path.
      move = function (dx, dy) {
        dx = Math.floor(dx * background.invertedScale);
        dy = Math.floor(dy * background.invertedScale);
        this.set.translate(dx - this.set.tmp[0], dy - this.set.tmp[1]);
        this.set.tmp = [dx, dy];
      };

      // Move a 'node' on the path.
      resize = function (dx, dy) {
        dx = Math.floor(dx * background.invertedScale);
        dy = Math.floor(dy * background.invertedScale);
        grabber = this.set[this.set.length - 1];
        grabber.moveFn(dx, dy);
      };

      // Add a point to the polygon.
      addPoint = function (background, x, y) {
        this.attr('path', this.attr('path') + ('L' + x + ',' + y));
        grabber = makeGrabber(background, this, x, y);
      };

      // Create the starting point.
      paper = background.paper;
      group = paper.set();
      outer = paper.path("M" + x + ',' + y);
      outer.attr(attributes);
      outer.addPoint = addPoint;
      group.push(outer);
      outer.set = group;

      grabber = makeGrabber(background, outer, x, y, 0);
      outer.drag(move, onStart, onEnd);
      outer.resizeFn = resize;
      return outer;
    }

    /**
     * Creates a Circle, where the user clicks, they can resize by dragging.
     *
     * @param {Element} background
     *   The background Raphael Element in which the coordinates are in.
     * @param {number} x
     *   The x coordinate.
     * @param {number} y
     *   The y coordinate.
     * @param {object} attributes
     *   HTML element attributes to apply to the polygon, like color or
     *   stroke-width.
     *
     * @returns {Element}
     *  The circle as a Raphael Element.
     */
    function makeCircle(background, x, y, attributes) {
      var inner, outer, group, paper, innerSize,
        onStart, onEnd, move, resize;
      // Make the innerSize large enough so that it's visible at the time of
      // creation.
      innerSize = Math.floor(10 * background.invertedScale);

      // Start the drag event.
      onStart = function () {
        this.start = [this.attr("cx"), this.attr("cy"), this.attr('r')];
      };

      // Finish the drag event.
      onEnd = function () {
        this.start = undefined;
      };

      // Move the Circle.
      move = function (dx, dy) {
        this.set.attr({
          cx: this.start[0] + Math.floor(dx * background.invertedScale),
          cy: this.start[1] + Math.floor(dy * background.invertedScale)
        });
      };

      // Resize the Circle.
      resize = function (dx, dy) {
        var outerRadius = this.start[2] + Math.floor(dx * background.invertedScale),
          innerRadius = this.start[2] + (Math.floor(dx * background.invertedScale) - innerSize);
        this.attr('r', Math.max(0, outerRadius));
        this.inner.attr('r', Math.max(0, innerRadius));
      };

      // Draw the circle and it's icon.
      paper = background.paper;
      group = paper.set();

      // This is the circle the user is drawing.
      outer = paper.circle(x, y, innerSize);
      outer.attr(attributes);
      outer.start = [x, y, innerSize];
      outer.set = group;

      // The inner circle acts as tool to visualize the outer circle the user is
      // drawing / resizing / moving.
      inner = paper.circle(x, y, innerSize / 2);
      inner.attr({
        fill: '#ffffff',
        opacity: 0.3,
        stroke: 'black',
        'stroke-width': 'none',
        'stroke-dasharray': '- '
      });
      inner.toFront();
      inner.set = group;

      // Add the inner circle to the outer and add them to the set.
      outer.inner = inner;
      group.push(outer);
      group.push(inner);

      // Set up behaviours for drag resizing and moving.
      inner.drag(move, onStart, onEnd);
      outer.drag(resize, onStart, onEnd);
      outer.resizeFn = resize;
      // User can remove the annotation by double clicking on it's center.
      inner.dblclick(function () {
        this.set.remove();
      });
      return outer;
    }

    /**
     * Creates a Circle, where the user clicks, they can resize by dragging.
     *
     * @param {Element} background
     *   The background Raphael Element in which the coordinates are in.
     * @param {number} x
     *   The x coordinate.
     * @param {number} y
     *   The y coordinate.
     * @param {object} attributes
     *   HTML element attributes to apply to the polygon, like color or
     *   stroke-width.
     *
     * @returns {Element}
     *  The circle as a Raphael Element.
     */
    function makeRectangle(background, x, y, attributes) {
      var inner, outer, group, paper, innerSize, onStart, onEnd, move, resize;
      // Make the innerSize large enough so that it's visible at the time of
      // creation.
      innerSize = Math.floor(14 * background.invertedScale);

      // Start the drag event.
      onStart = function () {
        this.set.start = [
          Math.floor(this.set.outer.attr('x')),
          Math.floor(this.set.outer.attr('y')),
          Math.floor(this.set.outer.attr('height')),
          Math.floor(this.set.outer.attr('width'))
        ];
      };

      // End the drag event.
      onEnd = function () {
        this.set.start = undefined;
      };

      // Move the Rectangle.
      move = function (dx, dy) {
        this.set.outer.attr({
          'x': this.set.start[0] + Math.floor(dx * background.invertedScale),
          'y' : this.set.start[1] + Math.floor(dy * background.invertedScale)
        });
        this.set.inner.attr({
          'x': this.set.start[0] + this.set.start[3] + Math.floor(dx * background.invertedScale) - innerSize,
          'y' : this.set.start[1] + this.set.start[2] + Math.floor(dy * background.invertedScale) - innerSize
        });
      };

      // Resize the Rectangle.
      resize = function (dx, dy) {
        var width, height;
        height = this.set.start[2] + Math.floor(dy * background.invertedScale);
        width = this.set.start[3] + Math.floor(dx * background.invertedScale);
        this.set.outer.attr({
          'width' : Math.max(0, width),
          'height' : Math.max(0, height)
        });
        this.set.inner.attr({
          'x' : this.set.start[0] + this.set.start[3] + Math.floor(dx * background.invertedScale) - innerSize,
          'y': this.set.start[1] + this.set.start[2] + Math.floor(dy * background.invertedScale) - innerSize
        });
      };

      // Draw the rectangle and it's icon.
      paper = background.paper;
      group = paper.set();
      group.start = [x, y, innerSize, innerSize];
      outer = paper.rect(x, y, innerSize, innerSize);
      outer.attr(attributes);
      outer.set = group;
      group.push(outer);
      // The inner circle acts as tool to visualize the outer circle the user is
      // drawing / resizing / moving.
      inner = paper.rect(x, y, innerSize + 1, innerSize + 1);
      inner.attr({
        fill: '#ffffff',
        opacity: 0.3,
        stroke: 'black',
        'stroke-width': 'none',
        'stroke-dasharray': '- '
      });
      inner.toFront();
      inner.set = group;
      group.push(inner);

      // Store references to both the outer and inner for use in onStart().
      group.outer = outer;
      group.inner = inner;

      // Set up behaviours for drag resizing and moving.
      inner.drag(resize, onStart, onEnd);
      outer.drag(move, onStart, onEnd);
      outer.resizeFn = resize;
      inner.dblclick(function () {
        this.set.remove();
      });
      return outer;
    }

    /**
     * Invert the given coordinates within the background.
     *
     * @param {Element} background
     *   The background in which the coordinates are in.
     * @param {number} x
     *   The x coordinate.
     * @param {number} y
     *   The y coordinate.
     *
     * @returns {[number, number]}
     *   The inverted XY coordinates.
     */
    function invertXYCoordinates(background, x, y) {
      var $wrap, $window, invertedX, invertedY;
      $wrap = $(background.paper.wrapperElem);
      $window = $(window);

      // This is location of canvas
      invertedX = x - $wrap.offset().left;
      invertedY = y - $wrap.offset().top;

      // Change made to support embedding shared canvas.
      invertedX += $window.scrollLeft();
      invertedY += $window.scrollTop();

      // And now scale for Canvas resizing
      invertedX = Math.floor(invertedX * background.invertedScale);
      invertedY = Math.floor(invertedY * background.invertedScale);
      return [invertedX, invertedY];
    }

    /**
     * Starts annotating.
     *
     * @param {string} canvas
     * @param {function} getAnnotationProperties
     *   Since we can change the display attributes while annotating we must
     *   fetch the latest attributes at the time of creating a shape.
     */
    this.startAnnotating = function (canvas, getAnnotationProperties) {
      var onStart, onEnd, raphael, invertedScale, canvasHeight, canvasWidth,
        background;

      // Start the drag event.
      onStart = function (x, y) {
        var invertedCoordinates, invertedX, invertedY, properties;
        invertedCoordinates = invertXYCoordinates(this, x, y);
        invertedX = invertedCoordinates[0];
        invertedY = invertedCoordinates[1];
        properties = getAnnotationProperties();
        switch (properties.shape) {
        case 'rectangle':
          this.creating = makeRectangle(this, invertedX, invertedY, properties.attributes);
          this.shapes.push(this.creating);
          break;
        case 'circle':
          this.creating = makeCircle(this, invertedX, invertedY, properties.attributes);
          this.shapes.push(this.creating);
          break;
        case 'polygon':
          if (this.creating === null) {
            this.creating = makePolygon(this, invertedX, invertedY, properties.attributes);
            this.shapes.push(this.creating);
          } else {
            this.creating.addPoint(this, invertedX, invertedY);
          }
          break;
        }
      };

      // End the drag event.
      onEnd = function () {
        var properties;
        properties = getAnnotationProperties();
        if (this.creating === null) {
          return;
        }
        // We don't do anything for polygons as they are driven by clicks rather
        // than the "main" drag event.
        switch (properties.shape) {
        case 'rectangle':
          if (this.creating.set !== undefined && this.creating.set.start !== undefined) {
            this.creating.set.start = [];
          }
          this.creating = null;
          break;
        case 'circle':
          // Clear all start events if any remain.
          if (this.creating.start !== undefined) {
            this.creating.start = [];
          }
          this.creating = null;
          break;
        }
      };
      // Create the Canvas / paper to render onto.
      raphael = that.makeRaphael('comment', canvas, that.canvasDivHash[canvas]);
      invertedScale = 1.0 / raphael.newScale;
      canvasHeight = Math.floor(raphael.height * invertedScale);
      canvasWidth = Math.floor(raphael.width * invertedScale);
      // Create a background rectangle in which will encompass the shapes drawn
      // by the user.
      background = raphael.rect(0, 0, canvasWidth, canvasHeight);
      background.attr({
        'fill': 'white',
        'opacity': 0.15
      });
      background.creating = null;
      background.paper = raphael;
      background.shapes = [];
      background.invertedScale = invertedScale;
      raphael.annotationBackground = background;
      background.drag(function (dx, dy) {
        // Delegate on resize to the element being resized.
        this.creating.resizeFn(dx, dy);
      }, onStart, onEnd);
    };

    // @todo Document
    function removeCommentAnnotations(canvas) {
      var raphael;
      if (that.raphaels.comment[canvas] !== undefined) {
        raphael = that.raphaels.comment[canvas];
        if (raphael.annotationBackground !== undefined) {
          $.each(raphael.annotationBackground.shapes, function (index, shape) {
            if (shape.set !== undefined) {
              shape.set.remove();
            } else {
              shape.remove();
            }
          });
          raphael.annotationBackground.remove();
          $(raphael.wrapperElem).remove();
          $(raphael).remove();
        }
        that.raphaels.comment[canvas] = undefined;
      }
    }

    // @todo Document
    this.stopAnnotating = function (canvas) {
        removeCommentAnnotations(canvas);
    };

    /**
     * Draw the given annotation on the given canvas element.
     *
     * This is much more minimal than what was originally part of the
     * SharedCanvas, it only supports rendering the entire image.
     * Scaled to fit the canvas.
     *
     * @param {object} annotation
     *   The annotation to draw.
     * @param canvasId
     *   The DOM element ID for the canvas.
     */
    function drawImageAnnotation(annotation, canvasId) {
      var canvas, canvasWidth, canvasHeight, scale, scaledHeight, scaledWidth,
        $imageAnnotation, $image;

      // @todo Refactor into a function.
      canvas = $('#' + canvasId).attr('canvas');
      canvasHeight = that.sequenceInfo[canvas][0];
      canvasWidth = that.sequenceInfo[canvas][1];
      scale = that.canvasWidth / canvasWidth;
      scaledHeight = scale * canvasHeight;
      scaledWidth = scale * canvasWidth;

      $imageAnnotation = $('<div />', {
        // We make the assumption that the annotation id will always have a uuid
        // in it.
        id: 'image-annotation-' + IIAUtils.urnComponents(annotation.id).nss,
        class: 'image-annotation'
      });
      $image = $('<img />', {
        src: annotation.getBodyTarget().id,
        width: scaledWidth,
        height: scaledHeight
      });
      $image.one('load', function() {
        // Update the canvas size to reflect the new image.
        that.resizeCanvas();
      });
      $("#annotations").append($imageAnnotation.append($image));
    }

    /**
     * @todo Document.
     */
    function drawCommentAnnotation(annotation, canvasId) {
      Drupal.IslandoraImageAnnotationList.getInstance().addAnnotation(annotation);

      /*
       var title, type, fixed_annotype, txt, tgt, myid, tgtttl, x,
       entity_link, block, selectBlock, id, canvas, pm, c;
       title = annotation.title;
       type = annotation.annoType;
       // remove illegal characters
       fixed_annotype = type.replace(/[^\w]/g, '');
       txt = annotation.body.value;
       myid = annotation.id.substring(9, 100);
       txt = txt.replace(/\n/g, '<br/>');

      // Grab the list object and update it, for now later we can switch to
      // events.
      entity_link = '';

      if (annotation.relation) {
        entity_link = '<div class="comment_entity">' + '<a href="' + Drupal.settings.islandora_image_annotation.entity_link_path +
          annotation.relation + '">' +
          annotation.hasPart + '</a>' + '</div>';
      }
      // block contains complete annotation
      block = '<div class="canvas-annotation" ' + 'urn="' + myid + '" ' + ' >';
      block += '<div class="comment_title" id="anno_' + myid + '"><span class="comment_showhide">+ </span>' + title + '</div>';
      block += '<div class="comment_text">' + '<div class="comment_type">' + type + '</div><div class="comment_content">' + txt + '</div>' + entity_link + '</div>';
      block += '</div>';

      selectBlock = "#islandora_annoType_content_" + fixed_annotype;
      if ($(selectBlock).append(block)) {
      }
      $('#anno_' + myid).attr('canvas', canvasId);

      $('#delete_anno_' + myid).click(function (event) {
        if (confirm("Permanently Delete This Annotation?")) {
          // @todo Implement this?
          // islandora_deleteAnno(myid);
        }
        event.preventDefault();
      });

      $('#anno_' + myid).click(function () {
        $(this).toggleClass('annotation-opened').next().toggle();
        pm = $(this).find('.comment_showhide');
        if (pm.text() === '+ ') {
          pm.empty().append('- ');
          id = $(this).attr('id').substring(5, 100);
          canvas = $(this).attr('canvas');
          paint_commentAnnoTargets(this, canvas, id, type);
        } else {
          $('.svg_' + myid).remove();
          c = $(this).find('.mycolor');
          // @todo Find out where this comes from.
          svgAreaColors.push(c.attr('color'));
          c.remove();
          pm.empty().append('+ ');
        }
        return false;
      }).next().hide();*/
    }

    /**
     * Draw the given annotation as the given type.
     *
     * Original version of shared Canvas apparently supported text and audio
     * annotations. This has been discontinued.
     *
     * @param {string} type
     *   The type of annotation to draw, expected to be either 'image' or
     *   'comment'.
     * @param {RDF.Annotation} annotation
     *   The annotation to draw
     * @param div
     *   The div to insert the drawn annotation into.
     */
    function drawAnnotation(type, annotation, div) {
      switch (type) {
      case 'image':
        drawImageAnnotation(annotation, div);
        break;
      case 'comment':
        drawCommentAnnotation(annotation, div);
        break;
      }
    }

    /**
     * @todo Document
     */
    function drawAnnotations() {
      // Step through all displayed canvases and paint all finished, unpainted
      // annotations. Do it this way as can't predict when annotations will be
      // available due to different AJAX speeds?
      // @todo is this shit true?
      $.each(that.canvasDivHash, function (canvas, div) {
        $.each(that.annotations, function (type, annotations) {
          if (annotations[canvas] !== undefined) {
            $.each(annotations[canvas], function (index, annotation) {
              if (annotation.finished && that.paintedAnnos.indexOf(annotation.id) === -1) {
                that.paintedAnnos.push(annotation.id);
                drawAnnotation(type, annotation, div);
              }
            });
          }
        });
      });
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
        // delete rdf.databank;
        // rdf = null;
      }

      xmlFiles = {};
      $.each(annotations, function (index, annotation) {
        var type, canvas;
        type = annotation.getType();;

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
        // @todo Test?
        rdf = createRDFBase();
        rdf = that.query;
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
     * @todo Document
     * @param pid
     */
    this.getCommentAnnotation = function (pid) {
      $.ajax({
        type: 'GET',
        url: '/islandora/anno/get_annotation/' + pid,
        success: function (data, status, xhr) {
          /*var rdf = $(data).rdf();
          if (rdf.databank.size() === 0) {
            try {
              //rdf = createRDFBase.load(data);
              rdf = that.query;
            } catch (exception) {
              console.log('Failed to load Comment Annotation: ' + exception);
              console.log(exception.stack);
            }
          }*/
          var rdf = that.query.add($(data).rdf());//databank.load(data);
          processAnnotations(rdf, '');
        }
      });
    };

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
      fetchAnnotations('image', canvas);
      fetchAnnotations('comment', canvas);
    }

    function showPage() {
      var canvas = that.sequence[0],
        canvasId = 'canvas';

      that.canvasDivHash[canvas] = canvasId;
      $('#' + canvasId).attr('canvas', canvas);
      showCanvas(canvas, canvasId);
    }

    function showPages() {
      // Empty current display
      $(".canvas").empty();
      $('#svg_wrapper').empty();
      $('#annotations').empty();

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
    this.resizeCanvas();
  };

  /**
   * Gets the global singleton of this class.
   *
   * This function is meant to be used after Drupal.attachBehaviors() has been
   * called, otherwise the singleton instance won't exist.
   *
   * @return {Drupal.IslandoraImageAnnotationDialog}
   *   The singleton
   */
  Drupal.IslandoraImageAnnotationCanvas.getInstance = function () {
    // @todo Hack for now, later fix and remove.
    if (Drupal.IslandoraImageAnnotationCanvas[base] === undefined) {
      $(base, document).once('islandoraImageAnnotation', function () {
        Drupal.IslandoraImageAnnotationCanvas[base] = new Drupal.IslandoraImageAnnotationCanvas(base, Drupal.settings.islandoraImageAnnotationCanvas);
      });
    }
    return Drupal.IslandoraImageAnnotationCanvas[base];
  };

}(jQuery));
