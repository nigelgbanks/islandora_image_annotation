/**
 * @file
 * Defines the Islandora Image Annotation widget and it's Drupal behaviour.
 *
 * Requires jQuery 1.7+.
 * Requires jQuery UI.
 */
(function ($) {
  'use strict';
  /**
   * The DOM element that represents the Singleton Instance of this class.
   * @type {string}
   */
  var base = '#islandora-image-annotation-dialog';

  /**
   * Initialize the Create Annotation Dialog Box.
   *
   * We can only have one Create Annotation Dialog Box per page.
   */
  Drupal.behaviors.islandoraImageAnnotationDialog = {
    attach: function (context, settings) {
      $(base, context).once('islandoraImageAnnotationDialog', function () {
        Drupal.IslandoraImageAnnotationDialog[base] = new Drupal.IslandoraImageAnnotationDialog(base, settings.islandoraImageAnnotationDialog);
      });
    }
  };

  /**
   * Instantiate the Create Annotation Dialog Box.
   *
   * @param {string} base
   *   The id of the html element in which to bind the dialog box to.
   *
   * @param {object} settings
   *   The Drupal.settings variable for this widget.
   *   - canSelectColour: boolean, indicates the user can choose the color of
   *     the annotation.
   *   - canLinkEntity: boolean, indicates the user can link an existing entity
   *     to the annotation.
   *
   * @constructor
   */
  Drupal.IslandoraImageAnnotationDialog = function (base, settings) {

    /**
     * Replaces the defined '%pid%' placeholder in the url so that it will
     *
     * @param url
     *   A url typically one from settings.urls.
     * @param pid
     *   An object identifier to use in the defined placeholder.
     *
     * @returns {string}
     *   A resolvable url which includes the given pid.
     */
    function insertPIDinURL(url, pid) {
      return url.replace('%pid%', pid);
    }

    /**
     * Fetches a random color from the 'svgAreaColors' table.
     *
     * @returns {string}
     */
    function getRandomColour() {
      var svgAreaColors = [
        '#FF0000', '#FF6600', '#FF9400', '#FEC500', '#FFFF00', '#8CC700',
        '#0FAD00', '#00A3C7', '#0064B5', '#0010A5', '#6300A5', '#C5007C'];
      return svgAreaColors[Math.floor(Math.random() * svgAreaColors.length)];
    }

    /**
     * Takes a Date object and converts it into an ISO formatted date.
     *
     * @param {Date} date
     *
     * @returns {string}
     */
    function isoDate(date) {
      var dt = date.getUTCFullYear().toString(),
        m = (date.getUTCMonth() + 1).toString(),
        dy = date.getUTCDate().toString(),
        hr = date.getUTCHours().toString(),
        mn = date.getUTCMinutes().toString(),
        sc = date.getUTCSeconds().toString();
      m = m.length === 1 ? '0' + m : m;
      dy = dy.length === 1 ? '0' + dy : dy;
      hr = hr.length === 1 ? '0' + hr : hr;
      mn = mn.length === 1 ? '0' + mn : mn;
      sc = sc.length === 1 ? '0' + sc : sc;
      return dt + '-' + m + '-' + dy + ' ' + hr + ':' + mn + ':' + sc + ' UTC';
    }

    /**
     * Maps the given DOMNode to an SVG XML string.
     *
     * @param {DOMNode} node
     *
     * @returns {string}
     */
    function nodeToSVG(node) {
      var SVG_NS = 'http://www.w3.org/2000/svg',
        name = node.nodeName,
        attributes;
      attributes = $.map(node.attributes, function (attribute) {
        return attribute.nodeName + "='" + attribute.nodeValue + "'";
      });
      attributes.push(" xmlns:svg='" + SVG_NS + "' ");
      return '<svg:' + name + ' ' + attributes.join(' ') + '></svg:' + name + '>';
    }

    /**
     * Generates RDFa representing the annotation the user has created.
     *
     * The parameters define the information the user has provided in the create
     * annotation form and the canvas and shapes they have drawn.
     *
     * All the parameters are required. Except entityID, entityLabel which are
     * optional.
     *
     * @param title
     * @param type
     * @param entityID
     * @param entityLabel
     * @param color
     * @param content
     * @param canvas
     * @param shapes
     *
     * @returns {object}
     *  - annotationID: The uuid that identifies this annotation.
     *  - contentID: The uuid that identifies this annotations content.
     *  - rdfa: A html rdfa representation of this annotation
     */
    function createAnnotation(title, type, entityID, entityLabel, color, content, canvas, shapes) {
      var namespaces, xmlns, rdfa, annotationUUID, contentUUID;
      namespaces = {
        dc: 'http://purl.org/dc/elements/1.1/',
        dcterms: 'http://purl.org/dc/terms/',
        dctype: 'http://purl.org/dc/dcmitype/',
        oa: 'http://www.w3.org/ns/openannotation/core/',
        cnt: 'http://www.w3.org/2008/content#',
        dms: 'http://dms.stanford.edu/ns/',
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        ore: 'http://www.openarchives.org/ore/terms/',
        exif: 'http://www.w3.org/2003/12/exif/ns#'
      };
      // We build the rdfa as a string.
      rdfa = '';
      annotationUUID = new UUID();
      contentUUID = new UUID();

      // Generate namespaces from RDF options
      xmlns = $.map(namespaces, function (value, key) {
        return 'xmlns:' + key + '="' + value + '"';
      });

      // Build the RDFa, open the Root Tag.
      rdfa = '<div ' + xmlns.join(' ') + '>'; // Open Root Div

      // Build Annotation, include UUID and type and creation date.
      rdfa += '<div about="urn:uuid:' + annotationUUID + '"> '; // Open Annotation Div
      rdfa += ('<a rel="rdf:type" href="' + namespaces.oa + 'Annotation' + '"></a>');
      rdfa += '<span property="dcterms:created" content="' + isoDate(new Date()) + '"></span> ';

      // Include the linked entity if defined.
      if (typeof entityID === 'string' && entityID !== '') {
        rdfa += '<span property="dcterms:relation" content="' + entityID + '"></span>';
        rdfa += '<span property="dcterms:hasPart" content="' + entityLabel + '"></span>';
      }

      // Include title / type.
      rdfa += '<span property="dc:title" content="' + title + '"></span>';
      rdfa += '<span property="dc:type" content="' + type + '"></span>';

      // Include the actual annotation field's content.
      rdfa += '<a rel="oa:hasBody" href="urn:uuid:' + contentUUID + '"></a>';
      rdfa += '<div about="urn:uuid:' + contentUUID + '">'; // Open Body Div
      rdfa += '<a rel="rdf:type" href="http://www.w3.org/2008/content#ContentAsText"></a>';
      rdfa += '<span property="cnt:chars">' + content + '</span> ';
      rdfa += '<span property="cnt:characterEncoding" content="utf-8"></span>';
      rdfa += '</div>'; // Close Body Div

      // Include shape SVG data.
      shapes.each(function (shape) {
        var svgXml, constrainedTargetUUID, svgConstraintUUID;
        svgXml = nodeToSVG(shape.node);
        constrainedTargetUUID = new UUID();
        svgConstraintUUID = new UUID();
        svgXml = svgXml.replace("stroke='#000000'", "stroke='" + color +  "'");
        // Escape html entities, probably could use some core
        // javascript for this.
        svgXml = svgXml.replace('<', '&lt;');
        svgXml = svgXml.replace('<', '&lt;');
        svgXml = svgXml.replace('>', '&gt;');
        svgXml = svgXml.replace('>', '&gt;');
        rdfa += '<a rel="oa:hasTarget" href="urn:uuid:' + constrainedTargetUUID + '"></a>';
        rdfa += '<div about="urn:uuid:' + constrainedTargetUUID + '">';
        rdfa += '<a rel="rdf:type" href="http://www.w3.org/ns/openannotation/core/ConstrainedTarget"></a>';
        rdfa += '<a rel="oa:constrains" href="' + canvas + '"></a>';
        rdfa += '<a rel="oa:constrainedBy" href="urn:uuid:' + svgConstraintUUID + '"></a>';
        rdfa += '<div about="urn:uuid:' + svgConstraintUUID + '">';
        rdfa += '<a rel="rdf:type" href="http://www.w3.org/ns/openannotation/core/SvgConstraint"></a>';
        rdfa += '<a rel="rdf:type" href="http://www.w3.org/2008/content#ContentAsText"></a>';
        rdfa += '<span property="cnt:chars" content="' + svgXml + '"></span>';
        rdfa += '<span property="cnt:characterEncoding" content="utf-8"></span>';
        rdfa += "</div>"; // Close Constraint
        rdfa += "</div>"; // Close Constrained Target
      });
      rdfa += "</div>"; // Close Annotation
      rdfa += "</div>"; // Close Root
      return {
        annotationID: annotationUUID,
        contentID: contentUUID,
        rdfa: rdfa
      };
    }

    /**
     * Creates an Annotation Object within Fedora from the data provided.
     *
     * @param {string} objectPid
     *   The object identifier in which to add the annotation to, note that a
     *   new annotation object is created as a child of this one.
     * @param {string} title
     *   The annotation's title.
     * @param {string} rdfa
     *   An rdfa xml encoded representation of the annotation.
     * @param {string} type
     *   The type of the annotation.
     * @param {string} color
     *   The color of the annotation shape.
     */
    function addAnnotationToObject(objectPid, title, rdfa, type, color) {
      $.ajax({
        type: 'POST',
        async: true,
        url: insertPIDinURL(settings.urls.addAnnotation, objectPid),
        data: {
          title: title,
          data: encodeURI(rdfa),
          type: type,
          color: color,
          strokeWidth: $('#stroke_width').val()
        },
        success: function (annotationPid, status, xhr) {
          // We successfully created a new annotation, it's content is slightly
          // different than what we posted as the server does some processing of
          // the posted data, so we have to make an additional request to get
          // the annotation again if we want to use it.
          $(Drupal.IslandoraImageAnnotation).trigger('IslandoraImageAnnotation.AddAnnotation', {
            objectPid: objectPid,
            annotationPid: annotationPid
          });
          // @todo Implement.
          // getAnnotation(annotationPid);
        },
        error: function (data, status, xhr) {
          // @todo Better error handling.
          alert('Failed to Create Annotation for: ' + objectPid);
        }
      });
    }

    /**
     * Fetches the html rdfa representation of the annotation.
     *
     * This function is async
     *
     * @param {string} pid
     *   Get pid of the annotation object to be fetched from Fedora.
     */
    function getAnnotation(pid) {
      $.ajax({
        type: 'GET',
        url: insertPIDinURL(settings.urls.getAnnotation, pid),
        success: function (data, status, xhr) {
          // @todo
          // load_commentAnno(data);
        },
        error: function (data, status, xhr) {
          // @todo Better error handling.
          alert('Failed to Get the Annotation: ' + pid);
        }
      });
    }

    /**
     * Creates a dialog box and displays it.
     *
     * @returns {*}
     */
    this.show = function () {
      $(base).dialog({
        title: Drupal.t('Annotate'),
        height: 680,
        width: 460,
        resizable: true,
        closeOnEscape: true,
        modal: false,
        position: {
          my: "left top",
          at: "left bottom",
          of: '#content'
        },
        open: function () {
          var randomColour;
          if (settings.canChooseColour) {
            randomColour = getRandomColour();
            $('#anno_color').attr('value', randomColour);
            $('.miniColors-trigger').css('background-color', randomColour);
            $('#color-picker-wrapper').hide();
            $('.color-picker').miniColors();
          }
        },
        buttons: [{
          text: 'Save',
          // Assumes only one canvas with a valid 'canvas' attribute.
          click: function () {
            var $title, title, content, type, color, canvas, shapes, annotation;

            $title = $('#islandora-image-annotation-dialog-title');
            title = $title.is('select') ? $('option:selected', $title).val() : $title.val();
            content = $('#islandora-image-annotation-dialog-text').val();
            type = $('#islandora-image-annotation-dialog-type').val();
            color = $('#islandora-image-annotation-dialog-color').attr('value');
            canvas = $('#canvases').find('.canvas[canvas]').attr('canvas');
            // @todo Set up a mechanism to fetch this info,
            // that.raphaels.comment[canvas].annotateRect.myShapes;
            shapes = [];

            // Minimally we only allow users to create content if they have
            // entered a title and annotation.
            if (!content || !title) {
              alert('An annotation needs both title and content');
              return 0;
            }
            // Also the user must have actually marked up the image.
            if (canvas === null) {
              alert('You must draw a shape around the target.');
              return 0;
            }

            // Set default type if not specified.
            type = (type === '' || type === null) ? Drupal.t('unclassified') : type;

            // @todo Entity Linking.

            // Create RDFa representing the current annotation, all the
            // parameters are required. Except entityID, entityLabel, it also
            // generates identifiers for the annotation and it's content.
            annotation = createAnnotation(title, type, null, null, color, content, canvas, shapes);
            addAnnotationToObject(settings.pid, canvas, annotation.rdfa, type, color);
            $(this).dialog('close');
          }
        }, {
          text: 'Cancel',
          click: function () {
            // @todo
            // closeAndEndAnnotating();
            $(this).dialog('close');
            //$('#hidden_annotation_type').text('');
          }
        }]
      });
    };
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
  Drupal.IslandoraImageAnnotationDialog.getInstance = function () {
    return Drupal.IslandoraImageAnnotationDialog[base];
  };

}(jQuery));
