<?php

/**
 * @file
 *
 * This file contains all theme and preprocess functions.
 */

/**
 * Implements template_preprocess_theme().
 */
function template_preprocess_islandora_image_annotation_view(array &$variables) {
  // Set preprocessor variables, for use in JavaScript.
  $variables['anno_list_pane'] = theme('islandora_anno_list_pane');
  $variables['anno_img_pane'] = theme('islandora_anno_image_pane');

  module_load_include('inc', 'islandora_image_annotation', 'includes/utils');
  $module_path = drupal_get_path('module', 'islandora_image_annotation');

  // Add css.
  drupal_add_css($module_path . '/shared_canvas/css/window_behaviors.css');
  drupal_add_css($module_path . '/shared_canvas/css/islandora_shared_canvas_style.css');
  drupal_add_css($module_path . '/shared_canvas/css/smoothness/jquery-ui-1.8.16.custom.css');

  // Add JavaScript.
  drupal_add_js($module_path . '/shared_canvas/js/jquery/jquery-1.7.js');
  drupal_add_js($module_path . '/shared_canvas/js/jquery/jquery-ui-1.8.13.custom.min.js');

  // Include common JavaScript/CSS.
  islandora_image_annotation_include_common_js();
  islandora_image_annotation_include_common_css();

  // Add JavaScript.
  drupal_add_js(array('islandora_image_annotation' => array('PID' => $variables['islandora_object']->id)), 'setting');
  $module_path = drupal_get_path('module', 'islandora_image_annotation');
  drupal_add_js($module_path . '/shared_canvas/stable/islandora_image_annotation_init.js');
}

/**
 * Implements template_preprocess_theme().
 */
function template_preprocess_islandora_image_annotation_dialog(array &$variables) {
  module_load_include('inc', 'islandora_image_annotation', 'includes/utils');
  $module_path = drupal_get_path('module', 'islandora_image_annotation');
  $variables['annotation_icons'] = array(
    'rectangle' => array(
      '#theme' => 'image',
      '#path' => "$module_path/images/draw_rectangle.png",
      '#attributes' => array(
        'id' => 'islandora-image-annotation-shape-rectangle',
        'class' => 'islandora-image-annotation-shape-icon',
      ),
    ),
    'circle' => array(
      '#theme' => 'image',
      '#path' => "$module_path/images/draw_circle.png",
      '#attributes' => array(
        'id' => 'islandora-image-annotation-shape-circle',
        'class' => 'islandora-image-annotation-shape-icon',
      ),
    ),
    'polygon' => array(
      '#theme' => 'image',
      '#path' => "$module_path/images/draw_polygon.png",
      '#attributes' => array(
        'id' => 'islandora-image-annotation-shape-polygon',
        'class' => 'islandora-image-annotation-shape-icon',
      ),
    ),
  );
  $variables['use_entity_tagging'] = variable_get('islandora_image_annotation_use_entity_tagging', TRUE);
  $variables['can_choose_colour'] = !variable_get('islandora_annotation_optimized', TRUE);
  $object = $variables['object'];
  $settings = array(
    'pid' => $object->id,
//    'categories' => islandora_image_annotation_get_categories($object),
//    'enforceTaxonomy' => variable_get('islandora_annotation_enforce_taxonomy', TRUE),
//    'allowEntityLinking' => variable_get('islandora_image_annotation_use_entity_tagging', TRUE),
//    'useTitleVocabulary' => variable_get('islandora_image_annotation_use_title_vocabulary', FALSE),
    'strokeWidths' => variable_get('islandora_image_annotation_stroke_width', '.3 .6 .9 1.2 1.5'),
    'canChooseColour' => $variables['can_choose_colour'],
    'urls' => array(
      // Implemented in JavaScript in RDF, which breaks with URL-encoding,
      // that's why we decode it here.
      'manifestUrl' => rawurldecode(url("islandora/anno/serve/%pid%/Manifest/manifest.xml", array('absolute' => TRUE))),
      'getURNs' => url('islandora/anno/get_urns/%pid%'),
      'addAnnotation' => url('islandora/anno/add_annotation/%pid%'),
      'getAnnotation' => url('islandora/anno/get_annotation'),
      'deleteAnnotation' => url('islandora/anno/delete_annotation'),
      'updateAnnotation' => url('islandora/anno/update_annotation'),
    ),
  );
  drupal_add_js(array('islandoraImageAnnotationDialog' => $settings), 'setting');
  drupal_add_library('system', 'ui.dialog');
  drupal_add_js("$module_path/js/islandora_image_annotation_dialog.js");
  drupal_add_css("$module_path/css/islandora_image_annotation.canvas.css");
}

/**
 * Implements template_process_theme().
 */
function template_process_islandora_image_annotation_dialog(array &$variables) {
  $variables['annotation_icons'] = drupal_render($variables['annotation_icons']);
}

/**
 * Helper function that lists all of the comments grouped by type.
 *
 * @todo Document and Move to a more reasonable location.
 *
 * @param AbstractObject $object
 *   The object in which the annotations are targeted at.
 *
 * @return array
 *   ...
 */
function islandora_image_annotation_get_annotations(AbstractObject $object) {
  $query = <<<QUERY
    PREFIX fedora-rels-ext: <http://islandora.ca/ontology/relsext#>
    PREFIX fedora-model: <info:fedora/fedora-system:def/model#>
    SELECT ?pid ?type from <#ri> WHERE {
      ?pid fedora-rels-ext:targets <info:fedora/{$object->id}> ;
        fedora-rels-ext:isAnnotationType ?type;
        fedora-model:state fedora-model:Active;
    }
    ORDER BY ASC(?type)
QUERY;
  $results = $object->repository->ri->sparqlQuery($query);
  $return = array();
  foreach ($results as $result) {
    // Annotations are grouped by type.
    $type = $result['type']['value'];
    $return[$type][] = array(
      'pid' => $result['pid']['value'],
    );
  }
  return $return;
}

/**
 * Implements template_preprocess_theme().
 */
function template_preprocess_islandora_image_annotation_list(array &$variables) {
  $module_path = drupal_get_path('module', 'islandora_image_annotation');
  $object = $variables['object'];
  $settings = array(
    'pid' => $object->id,
    'annotations' => islandora_image_annotation_get_annotations($object),
  );
  drupal_add_js(array('islandoraImageAnnotationList' => $settings), 'setting');
  drupal_add_css("$module_path/css/islandora_image_annotation.base.css");
  drupal_add_css("$module_path/css/islandora_image_annotation.list.css");
  drupal_add_js("$module_path/js/islandora_image_annotation_list.js");
}

/**
 * Implements template_preprocess_theme().
 */
function template_preprocess_islandora_image_annotation_canvas(array &$variables) {
  $module_path = drupal_get_path('module', 'islandora_image_annotation');
  $object = $variables['object'];
  $settings = array(
    'pid' => $object->id,
    // Implemented in JavaScript in RDF, which breaks with URL-encoding.
    'manifestUrl' => rawurldecode(url("islandora/anno/serve/{$object->id}/Manifest/manifest.xml", array('absolute' => TRUE))),
  );
  drupal_add_js(array('islandoraImageAnnotationCanvas' => $settings), 'setting');
  drupal_add_js("$module_path/js/islandora_image_annotation_utils.js");
  drupal_add_js("$module_path/js/rdf.js");
  drupal_add_js("$module_path/js/islandora_image_annotation_canvas.js");
  drupal_add_css("$module_path/css/islandora_image_annotation.canvas.css");
}

/**
 * Implements template_preprocess_theme().
 */
function template_preprocess_islandora_image_annotation(array &$variables) {
  //module_load_include('inc', 'islandora_image_annotation', 'includes/build_streams');
  module_load_include('inc', 'islandora_image_annotation', 'includes/utils');

  $object = $variables['object'];
  $settings = array(
    'pid' => $object->id,
    'editable' => !user_access(ISLANDORA_IMAGE_ANNOTATION_CREATE),
    'categories' => islandora_image_annotation_get_categories($object),
    'enforceTaxonomy' => variable_get('islandora_annotation_enforce_taxonomy', TRUE),
    'allowEntityLinking' => variable_get('islandora_image_annotation_use_entity_tagging', TRUE),
    'useTitleVocabulary' => variable_get('islandora_image_annotation_use_title_vocabulary', FALSE),
    'strokeWidths' => variable_get('islandora_image_annotation_stroke_width', '.3 .6 .9 1.2 1.5'),
    'canChooseColor' => variable_get('islandora_annotation_optimized', TRUE),
    'urls' => array(
      // Implemented in JavaScript in RDF, which breaks with URL-encoding.
      'manifestUrl' => rawurldecode(url("islandora/anno/serve/%pid%/Manifest/manifest.xml", array('absolute' => TRUE))),
      'get_urns' => url('islandora/anno/get_urns/%pid%'),
      'add_annotation' => url('islandora/anno/add_annotation/%pid%'),
      'get_annotation' => url('islandora/anno/get_annotation'),
      'delete_annotation' => url('islandora/anno/delete_annotation'),
      'update_annotation' => url('islandora/anno/update_annotation'),
    ),
  );
  drupal_add_js(array('islandoraImageAnnotation' => $settings), 'setting');
  // Set preprocessor variables, for use in JavaScript.
  //$variables['anno_list_pane'] = theme('islandora_anno_list_pane');
  //$variables['anno_img_pane'] = theme('islandora_anno_image_pane');
  $variables['dialog_box'] = array(
    '#theme' => 'islandora_image_annotation_dialog',
    '#object' => $object,
  );
  // We embed the list in our tabs, cause why not.
  drupal_add_library('system', 'ui.tabs');
  $module_path = drupal_get_path('module', 'islandora_image_annotation');
  drupal_add_js("$module_path/js/islandora_image_annotation_tabs.js");
  $variables['list'] = array(
    '#theme' => 'islandora_image_annotation_list',
    '#object' => $object,
  );
  $variables['canvas'] = array(
    '#theme' => 'islandora_image_annotation_canvas',
    '#object' => $object,
  );

  // @todo make as a library.
  module_load_include('inc', 'islandora_image_annotation', 'includes/utils');
  $module_path = drupal_get_path('module', 'islandora_image_annotation');

  // Add css.
  //drupal_add_css($module_path . '/js/shared_canvas/css/window_behaviors.css');
  //drupal_add_css($module_path . '/js/shared_canvas/css/islandora_shared_canvas_style.css');
  //drupal_add_css($module_path . '/js/shared_canvas/css/smoothness/jquery-ui-1.8.16.custom.css');

  // Add JavaScript.
  // Lets see if we can roll without this version of jQuery.
  // drupal_add_js($module_path . '/js/shared_canvas/js/jquery/jquery-1.7.js');
  // drupal_add_js($module_path . '/js/shared_canvas/js/jquery/jquery-ui-1.8.13.custom.min.js');

  // Include common JavaScript/CSS.
  // Previously in islandora_image_annotation_include_common_js();
  $image_annotation_module_path = drupal_get_path('module', 'islandora_image_annotation');

  drupal_add_js($image_annotation_module_path . '/lib/jquery/jquery.watermark.min.js');
  drupal_add_js($image_annotation_module_path . '/lib/jquery/contextMenu/jquery.contextMenu.js');
  drupal_add_js($image_annotation_module_path . '/lib/jquery/miniColors/jquery.miniColors.js');
  // @todo Check if I can remove this jquery.svg javascript call.
  drupal_add_js($image_annotation_module_path . '/lib/jquery/jquery.svg.js');
  drupal_add_js($image_annotation_module_path . '/lib/jquery/jquery.rdfquery.rdfa.min-1.1.js');
  drupal_add_js($image_annotation_module_path . '/lib/jquery/jquery.rdf.turtle.js');
  // @todo Remove if not needed.
  // drupal_add_js($image_annotation_module_path . '/lib/jquery/jquery.touchSwipe-1.2.4.js');
  drupal_add_js($image_annotation_module_path . '/lib/raphael/raphael.js');
  drupal_add_js($image_annotation_module_path . '/lib/raphael/scale.raphael.js');
  drupal_add_js($image_annotation_module_path . '/lib/uuid.js');


  /*
  drupal_add_js($image_annotation_module_path . '/js/shared_canvas/stable/sc_ui.js');
  drupal_add_js($image_annotation_module_path . '/js/shared_canvas/stable/sc_utils.js');
  drupal_add_js($image_annotation_module_path . '/js/shared_canvas/stable/sc_rdf.js');
  drupal_add_js($image_annotation_module_path . '/js/shared_canvas/stable/sc_rdfjson.js');
  drupal_add_js($image_annotation_module_path . '/js/shared_canvas/stable/sc_create.js');
  drupal_add_js($image_annotation_module_path . '/js/shared_canvas/stable/sc_pastebin.js');
  */
  // End Previously in.
  // Previously in islandora_image_annotation_include_common_css();
  $image_annotation_module_path = drupal_get_path('module', 'islandora_image_annotation');

  drupal_add_css($image_annotation_module_path . '/lib/jquery/contextMenu/jquery.contextMenu.css');
  drupal_add_css($image_annotation_module_path . '/lib/jquery/miniColors/jquery.miniColors.css');
  //drupal_add_css($image_annotation_module_path . '/js/shared_canvas/css/sc.css');
  // End Previously in.

  // Add JavaScript.

  //$module_path = drupal_get_path('module', 'islandora_image_annotation');
  //drupal_add_js($module_path . '/shared_canvas/stable/islandora_image_annotation_init.js');
  //drupal_add_js($module_path . '/js/islandora_image_annotation.js');
  //drupal_add_js($module_path . '/js/islandora_image_annotation_create_annotation_dialog.js');
}

function template_process_islandora_image_annotation(array &$variables) {
  $variables['dialog_box'] = drupal_render($variables['dialog_box']);
  $variables['list'] = drupal_render($variables['list']);
  $variables['canvas'] = drupal_render($variables['canvas']);
  $module_path = drupal_get_path('module', 'islandora_image_annotation');
  drupal_add_js("$module_path/js/islandora_image_annotation.js");
}