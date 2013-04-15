<?php

/**
 * @file
 * Utility functions for islandora image annotation module.
 */

/**
 * Retrieves the first found datastream from our default list from the object.
 *
 * @param string $pid
 *   The pid of the object.
 *
 * @return Datastream
 *   The datastream retrieved.
 */
function islandora_image_annotation_get_dsid($pid) {
  $object = islandora_object_load($pid);
  $dsid = NULL;
  $datastreams = variable_get('islandora_image_annotation_datastreams', 'OBJ JPG JPEG IMAGE');
  $datastreams = explode(' ', $datastreams);
  foreach ($datastreams as $datastream) {
    if (isset($object["$datastream"])) {
      $dsid = $datastream;
      break;
    }
  }
  return $dsid;
}

/**
 * Checks our admin table for an allowed datastream.
 *
 * @param string $pid
 *   The pid of an object.
 *
 * @return string
 *   The DSID of the annotation.
 */
function islandora_image_annotation_get_dsid_from_model($pid) {
  $dsid = 'OBJ';
  $item = islandora_object_load($pid);
  $models = $item->models;
  if (($key = array_search('fedora-system:FedoraObject-3.0', $models)) !== FALSE) {
    unset($models[$key]);
  }
  $models_to_dsids = variable_get('islandora_annotation_mappings');
  foreach ($models as $model) {
    if (isset($models_to_dsids[$model])) {
      $tmp_dsid = $models_to_dsids[$model]['DSID'];
      if (isset($item[$tmp_dsid])) {
        $dsid = $tmp_dsid;
      }
    }
  }
  return $dsid;
}

/**
 * Ajax callback for Shared Canvas, shared functionality in
 * islandora_image_annotation and islandora_critical_edition.
 * Supplies the basic data, including manifest URI. Returns json
 * to be echoed to the client.
 *
 * @param string $pid
 *   The Fedora object id to supply the data for
 *   
 * @param string $base_path
 *   The base path of the module in use 
 *   (islandora_image_annotation or islandora_critical_edition)
 *   
 * @param user $user
 *   The current drupal user.
 *   
 * TODO: Remove base_path and user from required params list
 */
function islandora_annotation_canvas_setup($pid,$base_path,$user){

  module_load_include('inc', 'islandora_image_annotation', 'includes/build_streams');
  module_load_include('inc', 'islandora_image_annotation', 'includes/callbacks');
  module_load_include('inc', 'islandora_paged_content', 'includes/utilities');
  module_load_include('inc', 'islandora_image_annotation', 'includes/rdf_builder');
  module_load_include('module', 'taxonomy', 'module');

  $item = islandora_object_load($pid);
  $rels = $item->relationships->get();
  //$rels = $item->relationships->get('info:fedora/fedora-system:def/model#', 'hasModel');
  foreach ($rels as $relationship) {
    if ($relationship['predicate']['value'] == 'hasModel') {
      $cmodel = $relationship['object']['value'];
    }
    if ($relationship['predicate']['value'] == 'isEditionOf') {
      $page_object = islandora_object_load($relationship['object']['value']);
    }
  }

  $stroke_width = variable_get('annotation_stroke_width', '1%');
  $mappings = variable_get('islandora_annotation_mappings', array());
  $optimized = variable_get('islandora_annotation_optimized', TRUE);
  $dropdown = variable_get('islandora_annotation_enforce_taxonomy', TRUE);

  $vid = isset($mappings[$cmodel]['TAX']) ? $mappings[$cmodel]['TAX']: NULL;

  $dsid = $mappings[$cmodel]['DSID'];

  if ($dropdown) {
    $terms = taxonomy_get_tree($vid, 0, 1);
    $categories = array();
    foreach ($terms as $term) {
      $categories[] = $term->name;
    }
  }
  else {
    $categories = islandora_annotations_get_type_terms();
  }

  $image_url = url("islandora/object/$pid/datastream/$dsid");
  $title = $item->label;
  $pages = array();
  $pages[1] = $pid;
  $position = array_search($pid, $pages);
  $results = array();
  $results['page_title'] = $item->label;
  $results['object_base'] = url("islandora/object/$pid");
  $results['position'] = $position;
  $results['pages'] = $pages;
  $results['no_edit'] = !user_access(ISLANDORA_IMAGE_ANNOTATION_CREATE);
  $results['categories'] = $categories;
  $results['use_dropdown'] = $dropdown;
  $results['manifest_url'] = rawurldecode(url("islandora/anno/serve/$pid/Manifest/manifest.xml", array('absolute' => TRUE)));
  $results['islandora_post_url'] = url("islandora/anno/add_annotation/$pid");
  $results['get_annotation_list_url'] = url("islandora/anno/get_urns/$pid");
  $results['islandora_get_annotation'] = url("islandora/anno/get_annotation/");
  $results['islandora_delete_annotation'] = url("islandora/anno/delete_annotation/$pid/");
  $results['islandora_update_annotation'] = url("islandora/anno/update_annotation/");

  $results['islandora_base_url'] = "$base_path";
  $results['islandora_anno_use_title_vocab'] = variable_get('annotation_use_title_vocabulary', FALSE);
  $results['islandora_anno_stroke_width'] = $stroke_width;
  $results['islandora_anno_stroke_widths'] = variable_get('annotation_stroke_widths', '.3 .6. .9  1.2 1.5');

  $results['image_url'] = $image_url;
  $results['can_choose'] = !$optimized;

  $json = json_encode($results);
  return $json;
}
