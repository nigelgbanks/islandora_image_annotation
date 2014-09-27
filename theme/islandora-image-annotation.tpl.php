<?php

/**
 * @file
 * Displays the image annotations list canvas and dialog box.
 */
?>
<div id="islandora-image-annotation">
  <div class="islandora-image-annotation-left-column">
    <div id="islandora-image-annotation-tabs">
      <ul>
        <li><a href="#islandora-image-annotation-list">Image Annotations</a></li>
      </ul>
      <?php print $list; ?>
    </div>
  </div>
  <div class="islandora-image-annotation-right-column">
    <button id="islandora-image-annotation-create-annotation-button"><?php print t('Annotate'); ?></button>
    <button id="islandora-image-annotation-full-window-button"><?php print t('Full Window'); ?></button>
    <div class="clearfix"></div>
    <?php print $canvas; ?>
  </div>
  <?php print $dialog_box; ?>
</div>
