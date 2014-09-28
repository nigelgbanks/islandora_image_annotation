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
  <input id="islandora-image-annotation-dialog-title" type="text" size="28" />
  <label for="islandora-image-annotation-dialog-type">Type:</label>
  <input id="islandora-image-annotation-dialog-type" type="text" size="28" />
  <?php if ($use_entity_tagging): ?>
    <label for="islandora-image-annotation-dialog-entity-type">Entity</label>
    <select id="islandora-image-annotation-dialog-entity-type" class="easyui-combobox" name="Add Entity" style="width:100px;">
      <option><?php print t('Tag Person'); ?></option>
      <option><?php print t('Tag Event'); ?></option>
      <option><?php print t('Tag Place'); ?></option>
      <option><?php print t('Tag Organization'); ?></option>
    </select>
    <input id="islandora-image-annotation-dialog-entity" />
  <?php endif; ?>
  <?php if ($can_choose_colour): ?>
    <label for="islandora-image-annotation-dialog-color">Color:</label>
    <input id ="islandora-image-annotation-dialog-color" name="color4" value="#91843c" class="color-picker" size="7" />
  <?php endif; ?>
  <label for="islandora-image-annotation-dialog-stroke-width">Stroke Width:</label>
  <input id="islandora-image-annotation-dialog-stroke-width" type="text" size="5" value=".3" />
  <label for="islandora-image-annotation-dialog-text">Annotation:</label>
  <textarea id="islandora-image-annotation-dialog-text" cols="40" rows="5"></textarea>
</div>