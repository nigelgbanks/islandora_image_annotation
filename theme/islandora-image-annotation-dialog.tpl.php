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

<?php if (FALSE): ?>
<div id="create_annotation_box" title="Annotate" style="display:none">
  <div id="hidden_annotation_type" type="hidden"></div>
  <div style="display:inline; margin-top: 3px; padding-left: 5px;">
    <?php print $annotation_icons; ?>
    <hr style="margin: 0px; padding: 0px; height: 1px;"/>
  </div>
  <div id="create_annos_block" class="dragBlock">
    <div class="element-wrap">
      <label for="anno_title">Title:</label>
      <input id="anno_title" type="text" size="28" />
    </div>
    <div id ="islandora_classification" class="element-wrap">
      <div id="type_wrapper" class="element-wrap">
        <label for="anno_type">Type:</label>
        <input id="anno_classification" type="text" size="28" />
      </div>
      <?php if ($can_link_entities): ?>
        <div id="entity_wrapper" class="element-wrap">
          <label for="cboAddEntity">Entity</label>
          <select id="cboAddEntity" class="easyui-combobox" name="Add Entity" style="width:100px;">
            <option>Tag Person</option>
            <option>Tag Event</option>
            <option>Tag Place</option>
            <option>Tag Organization</option>
          </select>
          <input id="cboEntityLookup" />
          <div id="hidden_entity" type="hidden" data-entity=""></div>
        </div>
      <?php endif ?>
    </div>
    <div id ="color-picker-wrapper" class="element-wrap">
      <label for="anno_color">Color:</label>
      <input id ="anno_color" type="hidden" name="color4" value="#91843c" class="color-picker" size="7" />
      <input id ="anno_color_activated" type="hidden" value ="" size="7" />
    </div>
    <div id ="stroke-width-wrapper" class="element-wrap">
      <label for="stroke_width">Stroke Width:</label>
      <input id="stroke_width" type="text" size="5" value=".3" />
    </div>
    <div class="element-wrap">
      <label for="anno_text">Annotation:</label>
      <textarea id="anno_text" cols="40" rows="5"></textarea>
    </div>
    <span style="width:200px;margin:0px;padding:0px;float:left">
        <ul id="create_body" style="width: 200px; list-style:none;font-size:10pt;margin:0;padding:0;">
        </ul>
      </span>
  </div>
</div>
<?php endif; ?>