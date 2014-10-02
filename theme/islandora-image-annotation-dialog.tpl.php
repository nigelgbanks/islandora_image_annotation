<?php

/**
 * @file
 * The dialog box used to create new annotations.
 */
?>
<div id="islandora-image-annotation-dialog" style="display: none;">
  <?php print $annotation_icons; ?>
  <hr/>
  <label for="islandora-image-annotation-dialog-title">Title:</label>
  <input id="islandora-image-annotation-dialog-title" name="title" type="text" size="28" />
  <label for="islandora-image-annotation-dialog-type">Type:</label>
  <input id="islandora-image-annotation-dialog-type" name="type" type="text" size="28" />
  <?php if ($use_entity_tagging): ?>
    <label for="islandora-image-annotation-dialog-entity-type">Entity</label>
    <select id="islandora-image-annotation-dialog-entity-type" class="easyui-combobox" name="entity_type" style="width:100px;">
      <option value="person"><?php print t('Tag Person'); ?></option>
      <option value="event"><?php print t('Tag Event'); ?></option>
      <option value="place"><?php print t('Tag Place'); ?></option>
      <option value="organization"><?php print t('Tag Organization'); ?></option>
    </select>
    <input id="islandora-image-annotation-dialog-entity" name="entity"/>
  <?php endif; ?>
  <?php if ($can_choose_colour): ?>
    <div id ="islandora-image-annotation-dialog-color-wrapper">
      <label for="islandora-image-annotation-dialog-color">Color:</label>
      <input id ="islandora-image-annotation-dialog-color" name="color" type="hidden" value="#91843c" class="color-picker" size="7" />
    </div>
  <?php endif; ?>
  <label for="islandora-image-annotation-dialog-stroke-width">Stroke Width:</label>
  <input id="islandora-image-annotation-dialog-stroke-width" name="stroke" type="text" size="5" value=".3" />
  <label for="islandora-image-annotation-dialog-text">Annotation:</label>
  <textarea id="islandora-image-annotation-dialog-text" name="text" cols="40" rows="5"></textarea>
  <!-- The Canvas this annotation belongs to. -->
  <input id="islandora-image-annotation-dialog-canvas" name="canvas" type="hidden" />
  <!-- The Shape to use. -->
  <input id="islandora-image-annotation-dialog-shape" name="shape" type="hidden" />
</div>