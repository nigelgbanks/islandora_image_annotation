<?php

/**
 * @file
 * Displays the image annotations list canvas and dialog box.
 */
?>
<div class="islandora-image-annotation-wrapper">
  <div class="colmask">
    <div class="colleft">
      <div id="islandora-image-annotation-tabs">
        <ul>
          <li><a href="#islandora-image-annotation-list">Image Annotations</a></li>
        </ul>
        <?php print $list; ?>
      </div>
    </div>
    <div id="colright" class="colright">
      <button id="create_annotation" class="menu_button">Annotate</button>
      <button id="full-window-button" class="menu_button"><?php print t('Full Window'); ?></button>
      <?php print $canvas; ?>
    </div>
  </div>
  <!-- Initially hidden. -->
  <?php print $dialog_box; ?>
</div>
