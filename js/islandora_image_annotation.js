/**
 * @file
 * Defines the Islandora Image Annotation widget and it's Drupal behaviour.
 */
(function ($) {
  'use strict';

  /**
   * Causes the 'Annotate' button to display the Create Annotation Dialog.
   *
   * @type {{attach: attach}}
   */
  Drupal.behaviors.islandoraImageAnnotationCreateAnnotation = {
    attach: function (context, settings) {
      var base = '#islandora-image-annotation-create-annotation-button';
      $(base, context).once('islandoraCreateAnnotation', function () {
        $(this).click(function () {
          Drupal.IslandoraImageAnnotationDialog.getInstance().show();
        });
      });
    }
  };

  /**
   * Toggle the 'Full Window' display of the Image Annotation Widget.
   *
   * @type {{attach: attach}}
   */
  Drupal.behaviors.islandoraImageAnnotationFullWindow = {
    attach: function (context, settings) {
      var base = '#islandora-image-annotation-full-window-button';
      $(base, context).once('islandoraToggleFullWindow', function () {
        var $imageAnnotation = $('#islandora-image-annotation'),
          $fullWindowButton = $(base),
          messageId = 'islandora-exit-full-window-message',
          fullWindowClass = 'islandora-image-annotation-full-window';

        /**
         * Displays a message that ESC can be used to exit full window mode.
         */
        function displayExitFullWindowMessage() {
          // Add a message to notify user of the 'ESC' button.
          var $message = $('<div/ >', {
            id: messageId
          }).html(Drupal.t('Press ESC to exit full screen')).hide();
          $('.islandora-image-annotation-right-column').prepend($message);
          $message.fadeIn(400, function () {
            setTimeout(function () {
              $message.fadeOut(400, function () {
                $message.remove();
              });
            }, 3000);
          });
        }

        /**
         * Removes the message that ESC can be used to exit full window mode.
         */
        function removeExitFullWindowMessage() {
          var $message = $('#' + messageId);
          if ($message.length > 0) {
            $message.remove();
          }
        }

        /**
         * Toggle the Full Window Display.
         */
        function toggleFullWindowDisplay() {
          // Use the class to toggle.
          $imageAnnotation.toggleClass(fullWindowClass);

          // Resize the Canvas.
          Drupal.IslandoraImageAnnotationCanvas.getInstance().resizeCanvas();

          if ($imageAnnotation.hasClass(fullWindowClass)) {
            $fullWindowButton.html(Drupal.t('Exit Full Window'));
            // Don't display over top of the Admin Menu.
            $imageAnnotation.css('top', $('#admin-menu-wrapper').height());
            displayExitFullWindowMessage();
          } else {
            $fullWindowButton.html(Drupal.t('Full Window'));
            removeExitFullWindowMessage();
          }
        }

        // Toggle 'Full Window' when clicked.
        $fullWindowButton.click(function () {
          toggleFullWindowDisplay();
        });

        // Exit 'Full Window' when ESC is pressed.
        $(document).keyup(function (event) {
          // Only preform the 'ESC' functionality if in full window mode.
          if (event.keyCode === 27 && $imageAnnotation.hasClass(fullWindowClass)) {
            toggleFullWindowDisplay();
          }
        });
      });
    }
  };

}(jQuery));
