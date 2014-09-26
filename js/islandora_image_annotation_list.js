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
   * Initialize the Tabs section of the Image annotation widget.
   *
   * We can only have one Tabs per page.
   */
  Drupal.behaviors.islandoraImageAnnotationList = {
    attach: function (context, settings) {
      var base = '#islandora-image-annotation-list';
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


    /**
     * Dumb conversion not really safe in all cases, assumes the string is
     * already a valid HTML ID, just makes it work with jQuery.
     *
     * @param {string} id
     *  The id to convert.
     *
     * @returns {string}
     *   An id that is safe to use with jQuery.
     */
    function jQuerySafeHTMLID(id) {
      var regex = /[^0-9a-zA-Z-_]/g;
      return id.replace(regex, '-');
    }

    /**
     *
     * @param type
     */
    function toggleTypeDisplay(type) {

    }

    /**
     * Toggles the display of the annotation identified by the given urn.
     *
     * @param urn
     *   The <NSS> portion of a uuid urn. "urn:"<NID>":"<NSS>.
     */
    function toggleAnnotationDisplay(urn) {
      var $annotation = $(".canvas-annotation[urn='" + urn + "']", base);
      $('.comment-text, span.color', $annotation).toggle();
      $('.comment-title', $annotation).toggleClass('annotation-opened');
      if ($('span.color', $annotation).is(':visible')) {
        $('.comment-show-hide', $annotation).text('-');
        // Display the annotation on the canvas.
      } else {
        $('.comment-show-hide', $annotation).text('+');
      }
    }

    /**
     * Toggles the display of the annotation identified by the given urn.
     *
     * Shows the comment text section of the annotation and the annotation color
     * icon, also displays the annotation shapes on the canvas.
     *
     * @param urn
     *   The <NSS> portion of a uuid urn. "urn:"<NID>":"<NSS>.
     */
    function showAnnotation(urn) {
      var $annotation = $(".canvas-annotation[urn='" + urn + "']", base);
      $('.comment-text, span.color', $annotation).show();
      $('.comment-show-hide', $annotation).text('-');
      $('.comment-title', $annotation).addClass('annotation-opened');
      // @todo this does not make sense here.
      // paint_commentAnnoTargets(this, $annotation.attr('canvas'), urn);
    }

    /**
     * Converts the given annotation to a html list item.
     *
     * @param {string} type
     * @param {[object]} annotations
     *
     * @returns {string}
     */
    function getAnnotationTypeListItem(type, annotations) {
      var $type, $typeTitle, $content;
      // Annotations are grouped by type.
      $type = $('<div />', {
        //id: jQuerySafeHTMLID('islandora-image-annotation-' + type),
        class: 'comment-type-container'
      });
      $typeTitle = $('<div class="comment-type-title">' + type + '</div>');
      // Display the Content when the title is clicked.
      $typeTitle.click(function () {
        $('+ .comment-type-content', this).toggle();
      });
      // Each annotation is listed in the content section, which is initially
      // hidden.
      $content = $('<div />', {
        //id: jQuerySafeHTMLID('islandora-image-annotation-content-' + type),
        class: 'comment-type-content'
      }).hide();
      // Add each annotation to the content section.
      $.each(annotations, function (i, annotation) {
        var $annotation, $annotationTitle, $color, $annotationText, urn;
        urn = IIAUtils.urnComponents(annotation.urn);
        // Create annotation block.
        $annotation = $('<div />', {
          urn: urn.nss,
          canvas: 'canvas_0',
          class: 'canvas-annotation'
        });
        // Create Color Icon.
        $color = $('<span />', {
          color: annotation.color,
          class: 'color',
          style: 'background:' + annotation.color + ';'
        }).hide();
        // Add Title, including the color icon.
        $annotationTitle = $('<div />', {
          //id: 'anno_' + jQuerySafeHTMLID(urn.nss),
          class: 'comment-title'
        }).append('<span class="comment-show-hide">+</span>');
        $annotationTitle.append('<span>' + annotation.title + '</span>', $color);
        // Display the annotation when the title is clicked.
        $annotationTitle.click(function () {
          toggleAnnotationDisplay(urn.nss);
        });
        // Add Text, initially hidden.
        $annotationText = $('<div class="comment-text" />').hide();
        $annotationText.append('<div class="comment-type">' + type + '</div>');
        $annotationText.append('<div class="comment-content">' + annotation.text + '</div>');
        $content.append($annotation.append($annotationTitle, $annotationText));
      });
      return $type.append($typeTitle, $content);
    }

    // Add all the currently defined annotations to the list.
    $.each(settings.annotations, function (type, annotations) {
      $(base).append(getAnnotationTypeListItem(type, annotations));
    });

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
        var $title, $annotation, urn, title;
        $title = $(this);
        $annotation = $title.parent('.canvas-annotation');
        urn = $annotation.attr('urn');
        title = $('span:nth-child(2)', $title).text().trim();

        switch (key) {
        case 'edit':
          showAnnotation(urn);
          // @todo Open Dialog box, and pre-populate it.
          // startEditting(title, annotation, anno_type, urn);
          break;

        case 'delete':
          if (confirm("Permanently Delete Annotation '" + title + "'")) {
            // @todo Make this part of a ImageAnnotation Widget thing...
            // islandora_deleteAnno(urn);
          }
          break;
        }
      }
    });
  };
}(jQuery));
