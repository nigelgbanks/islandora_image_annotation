function lookup_entity(query) {
  var results;
  jQuery.ajax({
    url: Drupal.settings.islandora_image_annotation.entities_search_callback+ '/' + query,
    async: false,
    dataType: 'json',
    success: function(data, status, xhr) {
      if (jQuery.isPlainObject(data)) data = [data];
      if (data != null) {
        results = data;
      } else {
        results = [];
      }
    },
    error: function(xhr, status, error) {
      if (status == 'parsererror') {
        var lines = xhr.responseText.split(/\n/);
        if (lines[lines.length-1] == '') {
          lines.pop();
        }
        var string = lines.join(',');
        var data = jQuery.parseJSON('['+string+']');
        results = data;
      } else {
        results = null;
      }
    }
  });
  return results;
}
