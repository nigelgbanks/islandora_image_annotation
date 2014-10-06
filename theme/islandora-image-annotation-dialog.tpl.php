<?php

/**
 * @file
 * The dialog box used to create new annotations.
 */
?>
<div id="islandora-image-annotation-dialog" style="display: none;">
  <div class="icons">
    <?php print $annotation_icons; ?>
  </div>
  <hr/>
  <label><?php print t('Title:'); ?></label>
  <input name="title" type="text" size="28" />
  <label><?php print t('Type:'); ?></label>
  <input name="type" type="text" size="28" />
  <?php if ($use_entity_tagging): ?>
    <div class="entity-type">
      <label><?php print t('Entity'); ?></label>
      <select class="easyui-combobox" name="entity_type" style="width:100px;">
        <option value="person"><?php print t('Tag Person'); ?></option>
        <option value="event"><?php print t('Tag Event'); ?></option>
        <option value="place"><?php print t('Tag Place'); ?></option>
        <option value="organization"><?php print t('Tag Organization'); ?></option>
      </select>
      <input id="islandora-image-annotation-dialog-entity" name="entity"/>
    </div>
  <?php endif; ?>
  <div class="color">
    <label><?php print t('Color:'); ?></label>
    <input name="color" type="hidden" value="#91843c" class="color-picker" size="7" />
  </div>
  <div class="stroke">
    <label><?php print t('Stroke Width:'); ?></label>
    <input name="stroke" type="text" size="5" value=".3" />
  </div>
  <label><?php print t('Annotation:'); ?></label>
  <textarea name="text" cols="40" rows="5"></textarea>
  <!-- The Canvas this annotation belongs to. -->
  <input name="canvas" type="hidden" />
  <!-- The Shape to use. -->
  <input name="shape" type="hidden" />
</div>