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
  var base = '#islandora-image-annotation-list';

  /**
   * Initialize the Tabs section of the Image annotation widget.
   *
   * We can only have one Tabs per page.
   */
  Drupal.behaviors.islandoraImageAnnotationList = {
    attach: function (context, settings) {
      $(base, context).once('islandoraImageAnnotationList', function () {
        Drupal.IslandoraImageAnnotationList[base] = new Drupal.IslandoraImageAnnotationList(base, settings.islandoraImageAnnotationList);
      });
    }
  };

  /**
   * Instantiate the Annotation List.
   *
   * @param {string} base
   *   The id of the html element in which bind the list to.
   *
   * @param {object} settings
   *   The Drupal.settings variable for this widget.
   *
   * @constructor
   */
  Drupal.IslandoraImageAnnotationList = function (base, settings) {
    var annotations = [];

    /**
     * Gets a Random Color.
     *
     * @returns {string}
     */
    function getRandomColor() {
      var svgAreaColors = [
        '#FF0000', '#FF6600', '#FF9400', '#FEC500', '#FFFF00', '#8CC700',
        '#0FAD00', '#00A3C7', '#0064B5', '#0010A5', '#6300A5', '#C5007C'
      ];
      return svgAreaColors[Math.floor(Math.random() * svgAreaColors.length)];
    }

    /**
     * Looks for the given annotation targets canvas.
     *
     * The target will be the SVG annotation of the image, which is assumed to
     * be part of the canvas.
     *
     * @param {RDF.BodyTarget} target
     *   The annotation in which to targets a canvas, indirectly.
     *
     * @returns {string|null}
     *   The canvas identifier if found, null otherwise.
     */
    function getAnnotationTargetCanvas(target) {
      if (target.partOf !== undefined && target.partOf.id !== undefined) {
        return target.partOf.id;
      }
      return null;
    }

    /**
     * Draws the shape the target describes.
     *
     * @param svg
     * @param annotation
     * @param target
     */
    function drawShape(svg, annotation, target) {
      var shape = $(':first-child', $.parseXML(target.constraint.value));
      shape.attr('uuid', annotation.id);
      $(svg.canvas).append(shape);
    }

    /**
     * Shows the given annotation target on the Canvas.
     *
     * @param {RDF.Annotation} annotation
     *   The annotation in which targets belongs to.
     *
     * @param {RDF.BodyTarget} target
     *   The target to show.
     */
    function showAnnotationTarget(annotation, target) {
      var $canvas, canvas, svg;
      $canvas = $('.canvas[canvas="' + getAnnotationTargetCanvas(target) + '"]');
      canvas = Drupal.IslandoraImageAnnotationCanvas.getInstance();
      svg = canvas.makeRaphael('comment', $canvas.attr('canvas'), $canvas.attr('id'));
      drawShape(svg, annotation, target);
    }

    /**
     * Show all of the targets of the given annotation.
     *
     * This is rendered as shapes over-top of the image.
     *
     * @param {RDF.Annotation} annotation
     *   The annotation whose targets are to be rendered.
     */
    function showAnnotationTargets(annotation) {
      $.each(annotation.targets, function (index, target) {
        showAnnotationTarget(annotation, target);
      });
    }

    /**
     * Hides all of the annotations target SVG elements.
     *
     * @param {RDF.Annotation} annotation
     *   The annotation whose targets are to be rendered.
     */
    function hideAnnotationTargets(annotation) {
      $('svg *[uuid="' + annotation.id + '"]').remove();
    }

    /**
     * Toggles the display of the annotation identified by the given uuid.
     *
     * Shows the comment text section of the annotation and the annotation color
     * icon, also displays the annotation shapes on the canvas.
     *
     * @param {string} uuid
     *   The identifier for the annotation "urn:"<NID>":"<NSS>.
     */
    function showAnnotation(uuid) {
      var $annotation = $(".canvas-annotation[uuid='" + uuid + "']");
      $('.comment-text, span.color', $annotation).show();
      $('.comment-show-hide', $annotation).text('-');
      $('.comment-title', $annotation).addClass('annotation-opened');
      showAnnotationTargets(annotations[uuid]);
    }

    /**
     * @todo Document
     *
     * @param {string} uuid
     *   The identifier for the annotation "urn:"<NID>":"<NSS>.
     */
    function hideAnnotation(uuid) {
      var $annotation = $(".canvas-annotation[uuid='" + uuid + "']");
      $('.comment-text, span.color', $annotation).hide();
      $('.comment-show-hide', $annotation).text('+');
      $('.comment-title', $annotation).removeClass('annotation-opened');
      hideAnnotationTargets(annotations[uuid]);
    }

    /**
     * Toggles the display of the annotation identified by the given urn.
     *
     * @param uuid
     *   The uuid of the annotation to display "urn:"<NID>":"<NSS>.
     */
    function toggleAnnotationDisplay(uuid) {
      var $annotation = $(".canvas-annotation[uuid='" + uuid + "']", base);
      $('.comment-text, span.color', $annotation).toggle();
      $('.comment-title', $annotation).toggleClass('annotation-opened');
      if ($('span.color', $annotation).is(':visible')) {
        $('.comment-show-hide', $annotation).text('-');
        showAnnotation(uuid);
      } else {
        $('.comment-show-hide', $annotation).text('+');
        hideAnnotation(uuid);
      }
    }

    /**
     * Gets the type container from the given type.
     *
     * @returns {jQuery}
     *   jQuery wrapper around the type container if found, otherwise an empty,
     *   jQuery wrapper.
     */
    function getAnnotationTypeContainer(type) {
      return $('.comment-type-container[type="' + type + '"]');
    }

    /**
     * The list of comment annotations are grouped by type.
     *
     * @returns {bool}
     *   True if the given type container exists false otherwise.
     */
    function hasAnnotationTypeContainer(type) {
      return getAnnotationTypeContainer(type).length !== 0;
    }

    /**
     * Creates a container in which to put annotations by the given type.
     *
     * @returns {jQuery}
     *   True if the given type container exists false otherwise.
     */
    function createAnnotationTypeContainer(type) {
      var $type, $title, $content;
      // Annotations are grouped by type.
      $type = $('<div />', {
        class: 'comment-type-container',
        type: type
      });
      $title = $('<div class="comment-type-title">' + type + '</div>');
      // Display the Content when the title is clicked.
      $title.click(function () {
        $('+ .comment-type-content', this).toggle();
      });
      // Each annotation is listed in the content section, which is initially
      // hidden.
      $content = $('<div />', {
        class: 'comment-type-content'
      }).hide();
      return $type.append($title, $content);
    }

    /**
     * Gets the color of the given annotation.
     *
     * @param {RDF.BodyTarget} target
     *   The target to get the color from.
     *
     * @returns {string|null}
     *   The color in #ffffff format if found, otherwise null.
     */
    function getAnnotationTargetColor(target) {
      if (target.constraint !== undefined && target.constraint.value !== undefined) {
        return $(target.constraint.value).attr('stroke');
      }
      return null;
    }

    /**
     * Creates an Annotation element to insert into the list.
     *
     * @param {RDF.Annotation} annotation
     *   The annotation in which we will render into HTML.
     *
     * @returns {jQuery}
     *   The HTML as a jQuery object.
     */
    function createAnnotation(annotation) {
      var $annotation, $annotationTitle, $annotationText;
      // Create annotation block.
      $annotation = $('<div />', {
        uuid: annotation.id,
        // Make the assumption that only one canvas will ever exist, and we'll
        // always have at least one target.
        canvas: getAnnotationTargetCanvas(annotation.targets[0]),
        class: 'canvas-annotation'
      });
      // Add Title, including the color icon.
      $annotationTitle = $('<div />', {
        class: 'comment-title'
      }).append('<span class="comment-show-hide">+</span>');
      $annotationTitle.append('<span>' + annotation.title + '</span>');
      // Append Color Icons
      $.each(annotation.targets, function (index, target) {
        var color = getAnnotationTargetColor(target);
        $annotationTitle.append($('<span />', {
          color: color,
          class: 'color',
          style: 'background:' + color + ';'
        }).hide());
      });
      // Display the annotation when the title is clicked.
      $annotationTitle.click(function () {
        toggleAnnotationDisplay(annotation.id);
      });
      // Add Text, initially hidden.
      $annotationText = $('<div class="comment-text" />').hide();
      $annotationText.append('<div class="comment-type">' + annotation.annotationType + '</div>');
      $annotationText.append('<div class="comment-content">' + annotation.body.value + '</div>');
      $annotation = $annotation.append($annotationTitle, $annotationText);
      return $annotation;
    }

    // Create the comment type containers for the comment annotations.
    // trigger a load of each comment annotation.
    $.each(settings.annotations, function (type, annotations) {
      $(base).append(createAnnotationTypeContainer(type));
      $.each(annotations, function (index, annotation) {
        Drupal.IslandoraImageAnnotationCanvas.getInstance().getCommentAnnotation(annotation.pid);
      });
    });

    /**
     * Deletes the given Annotation from Fedora and the interface.
     *
     * @param {string} uuid
     *   The uuid of the annotation to display "urn:"<NID>":"<NSS>.
     */
    function deleteAnnotation(uuid) {
      var $annotation, urn;
      $annotation = $('.canvas-annotation[uuid="' + uuid + '"]');
      urn = IIAUtils.urnComponents(uuid);
      $.ajax({
        type: 'POST',
        // @todo Refactor the menu callbacks, as they require a pid they don't
        // use.
        url: '/islandora/anno/delete_annotation/pid/' + urn.nss,
        success: function (data, status, xhr) {
          var $content = $annotation.parent();
          // Remove the targets that are currently being displayed.
          hideAnnotationTargets(annotations[uuid]);
          // Remove the annotation from the list.
          $annotation.remove();
          // If there are no annotations of this type left anymore remove the
          // type, group from the list.
          if ($content.children().length === 0) {
            $content.parent().remove();
          }
        }
      });
    }

    // Set up context menu to display for each annotation title element.
    $.contextMenu({
      selector : '.comment-title',
      items: {
        edit: {
          name: "Edit",
          icon: "edit"
        },
        delete: {
          name : "Delete annotation",
          icon : "delete"
        }
      },
      callback : function (key, options) {
        var $title, $annotation, uuid, title;
        $title = $(this);
        $annotation = $title.parent('.canvas-annotation');
        uuid = $annotation.attr('uuid');
        title = $('span:nth-child(2)', $title).text().trim();

        switch (key) {
        case 'edit':
          showAnnotation(uuid);
          // @todo Open Dialog box, and pre-populate it.
          // startEditting(title, annotation, anno_type, urn);
          break;

        case 'delete':
          if (confirm("Permanently Delete Annotation '" + title + "'")) {
            deleteAnnotation(uuid);
          }
          break;
        }
      }
    });

    /**
     * Adds the given annotation to the list, or updates it.
     *
     * @todo Rename / Restructure.
     * @param annotation
     */
    this.addAnnotation = function (annotation) {
      var type, container;
      type = annotation.annotationType;
      if (hasAnnotationTypeContainer(type)) {
        container = getAnnotationTypeContainer(type);
      } else {
        container = createAnnotationTypeContainer(type);
        $(base).append(container);
      }
      annotations[annotation.id] = annotation;
      $('.comment-type-content', container).append(createAnnotation(annotation));
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
  Drupal.IslandoraImageAnnotationList.getInstance = function () {
    return Drupal.IslandoraImageAnnotationList[base];
  };

}(jQuery));
