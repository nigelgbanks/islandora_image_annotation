// Toggle full window shared canvas.
(function ($) {
  Drupal.behaviors.islandorAnnoFullWindow = {
    attach: function (context, settings) {
      jQuery('#full-window-button').click(function() {
        window_change_view_size();
      });
    }
  };
  jQuery(document).keyup(function(e) {
    if (e.keyCode == 27) {
      // Only preform the 'ESC' functionality if in full screen.
      if (jQuery('#full-window-button').html() != Drupal.t('Full Window')) {
        window_change_view_size();
      }
    }
  });
  // Add the 'ESC' key press exit full screen.
  function window_change_view_size() {
    jQuery('.islandora-anno-wrapper').toggleClass('islandora-anno-fullwindow');
    resizeCanvas();
    if (jQuery('#full-window-button').html() == Drupal.t('Full Window')) {
      jQuery('#full-window-button').html(Drupal.t('Exit Full Window'));
      jQuery('#islandora_shared_canvas_header').css('height', '0');
      
      jQuery('.islandora-anno-wrapper').css('top', jQuery('#admin-menu-wrapper').height());
      
      // Add a message to notify user of the 'ESC' button.
      $messageCont = jQuery('<div class="message_cont">');
      $message = jQuery('<div>Press ESC to exit full screen</div>').hide();
      $messageCont.append($message);
      jQuery('#colright').prepend($messageCont);
      $message.fadeIn(400, function() {
          setTimeout(function(){
              $messageCont.fadeOut(400, function(){
                jQuery('.message_cont').remove();
              });
          }, 3000);
      })
    }
    else {
      jQuery('#full-window-button').html(Drupal.t('Full Window'));
      jQuery('#islandora_shared_canvas_header').css('height', '0');
      if (jQuery('.message_cont').length > 0) {
        jQuery('.message_cont').remove();
      }
      
    }
  }
  
})(jQuery);

// Adapted from sc_init of the shared canvas project.
var startDate = 0;

var topinfo = {
    'canvasWidth' : 0,    // scaled width of canvas in pixels
    'numCanvases' : 0,    // number of canvases to display
    'current' : 0,        // current idx in sequence
    'done': [],           // URLs already processed
    'query' : null,       // top level databank
    'sequence' : [],      // Sequence list
    'sequenceInfo' : {},  // uri to [h,w,title]

    'annotations' : {
        'image' : {},
        'text' : {},
        'audio' : {},
        'zone' : {},
        'comment' : {}
    },
    'lists' : {
        'image' : {},
        'text' : {},
        'audio' : {},
        'zone' : {},
        'comment' : {}
    },
    'raphaels' : {
        'image' : {},
        'text' : {},
        'audio' : {},
        'zone' : {},
        'comment' : {}
    },

    'zOrders' : {
        'image' : 1,
        'detailImage' : 1000,
        'text' : 2000,
        'audio' : 3000,
        'zone' : 4000,
        'comment' : 5000
    },
    'canvasDivHash' : {},
    'builtAnnos' : [],
    'paintedAnnos' : [],
    'audioAnno' : null,
    'waitingXHR' : 0
};


var SVG_NS = "http://www.w3.org/2000/svg";
var XLINK_NS = "http://www.w3.org/1999/xlink";

var opts = {
    base : 'http://localhost/EmicShared/impl/',
    namespaces : {
        dc : 'http://purl.org/dc/elements/1.1/',
        dcterms : 'http://purl.org/dc/terms/',
        dctype : 'http://purl.org/dc/dcmitype/',
        oa : 'http://www.w3.org/ns/openannotation/core/',
        cnt : 'http://www.w3.org/2008/content#',
        dms : 'http://dms.stanford.edu/ns/',
        rdf : 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        ore : 'http://www.openarchives.org/ore/terms/',
        exif : 'http://www.w3.org/2003/12/exif/ns#'
    }
};

function initCanvas(nCanvas) {
    var w = jQuery('#canvas-body').width();
    var h = jQuery('#canvas-body').height();
    
    jQuery('#top_menu_bar').width(w - 5);

    for (var x = 0; x < nCanvas; x++) {
        jQuery('#canvases').append('<div id="canvas_' + x + '" class="canvas"></div>')
        jQuery('#canvas_' + x).width(w);
        jQuery('#canvas_' + x).height(h);
    }
    topinfo['canvasWidth'] = w;
    topinfo['numCanvases'] = nCanvas;

    if (nCanvas > 2) {
        // Default text off if lots of canvases
        jQuery('#check_show_text').attr('checked',false);
    }
};


function init_ui() {

  var anno_d = annotation_dialog();
  anno_d.dialog('close');

    jQuery('.dragBox').draggable().resizable();
    jQuery('.dragBox').hide();

    jQuery('.dragShade').click(function() {
        var sh = jQuery(this);
        if (sh.text() == '[-]') {
            sh.empty().append('[+]');
            var p = jQuery(this).parent(); // header
            var h = p.height();
            var pp = p.parent(); // box
            var nh = pp.height();
            sh.attr('ph', nh);
            p.next().hide();
            pp.height(h + 6);

        } else {
            var n = sh.parent().next();
            var nh = sh.attr('ph');
            var p = sh.parent().parent();
            p.height(nh);
            sh.empty().append('[-]');
            n.show();
        }
    });

    jQuery('#loadprogress').progressbar({
        value : 2
    }).css({
        height : 15,
        width : 300,
        opacity : 1.0,
        'z-index' : 10000
    });
    jQuery('#loadprogress').position({
        of : '#create_annotation',
        my : 'left top',
        at : 'right top',
        collision : 'none',
        offset : '10 0'
    })

    jQuery(".menu_body li:even").addClass("alt");

    // Link to menus
    jQuery('.menu_head').click(function () {
        // First find our id, and then use to find our menu
        var id = jQuery(this).attr('id');
        var menubody = jQuery('#' + id + '_body')
        menubody.slideToggle('medium');
        menubody.position({
            'of' : '#' + id,
            'my' : 'top left',
            'at' : 'bottom left',
            'collision' : 'fit',
            'offset' : '0 8'
        })
    });

    try {
        // May not want to allow annotation
        maybe_config_create_annotation();
    } catch (e) {
    // XXX Remove annotation button and shape menu

    }
    jQuery('#color-picker-wrapper').click(function(){
        jQuery('#anno_color_activated').attr('value', 'active');
      });
      jQuery('.color-picker').miniColors();
    // Refresh Canvas if browser is resized
    // We're called as per move... so need wait till finished resizing
    jQuery(window).resize(function() {
        resizeCanvas();
    });
}

var timeout = false;
var delta = 300;
function resizeCanvas() {
  var w = jQuery('#canvas-body').width();
  if(timeout === false) {
    timeout = true;
    closeAndEndAnnotating();
    window.setTimeout(maybeResize, delta);
  }
}

function maybeResize() {
    timeout = false;
    var w = jQuery('#canvas-body').width();
    var image_element = jQuery('.base_img').children(":first");
    
    initCanvas(topinfo['numCanvases']);
    image_element.width(w);
    image_element.css("height", "auto");
    jQuery('.base_img').css("height", image_element.height());
    jQuery('#canvas_0').css("width", w);
    
    // Set the top to zero.
    jQuery('.islandora-anno-wrapper').css('top', 0);
    
    // Resize incase we have the admin menu available.
    if(jQuery('#admin-menu-wrapper').length > 0) {
      jQuery('.islandora-anno-wrapper').css('top', jQuery('#admin-menu-wrapper').height());
    }
}

// Let's start it up!
jQuery(document).ready(function(){
    // gets setup information from Islandora
    jQuery.ajax({
        url: Drupal.settings.basePath + 'islandora/anno/setup/'
          + Drupal.settings.islandora_image_annotation.PID,
        async:false,
        success: function(data, status, xhr) {
            islandora_canvas_params = data;
        },
        error: function(data, status, xhd) {
            alert("Please Login to site");
        },
        dataType: 'json'
    });

    //establish color-picker if allowed
    if(islandora_canvas_params.can_choose){
        jQuery('#color-picker-wrapper').click(function(){
            jQuery('#anno_color_activated').attr('value', 'active');
        });
        jQuery('.color-picker').miniColors();
    }
    else{
        jQuery('#color-picker-wrapper').empty();
    }

    if(islandora_canvas_params.no_edit == true){
        jQuery('#create_annotation').hide();
    }
    else{
        jQuery(function(){
            jQuery.contextMenu({
                selector : '.comment_title',
                callback : function(key, options) {
                    var urn = jQuery(this).attr('id');
                    urn = urn.substring(5,100);
                    var title = jQuery(this).text().substring(2,100);
                    title = title.trim();

                    var comment_text = jQuery(this).next('.comment_text');
                    var anno_type = comment_text.find('.comment_type').text();

                    if(key == 'delete'){
                        if (confirm("Permananently Delete Annotation '" + title + "'")) {
                            islandora_deleteAnno(urn);
                        }
                    }

                    if(key == 'edit'){
                        jQuery(this).addClass('annotation-opened').next().show();
                        var annotation = comment_text.find('.comment_content').text();
                        var pm = jQuery(this).find('.comment_showhide');
                        if (pm.text() == '+ ') {
                            pm.empty().append('- ');
                            var id = jQuery(this).attr('id').substring(5,100);
                            var canvas = jQuery(this).attr('canvas');
                            paint_commentAnnoTargets(this, canvas, id);
                        }
                        jQuery('#hidden_annotation_type').attr('anno_type','Update Annotation');
                        jQuery('#hidden_annotation_type').attr('urn',urn);
                        startEditting(title, annotation, anno_type, urn)
                    }
                },
                items: {
                    "edit": {
                        name : "Edit",
                        icon : "edit",
                        accesskey : "e"
                    },
                    "delete" : {
                        name : "Delete annotation",
                        icon : "delete"
                    }
                }
            });
        });
    }
    opts.base = islandora_canvas_params.object_base;

    if(islandora_canvas_params.use_dropdown == 1){
        jQuery('#islandora_classification').empty();
        jQuery('<label for="anno_classification">Type:</label>').appendTo('#islandora_classification');
        var sel = jQuery('<select  id="anno_classification">').appendTo('#islandora_classification');
    
        jQuery(islandora_canvas_params.categories).each(function() {
            value = this.toString();
            sel.append(jQuery("<option>").attr('value',value).text(value));
        });
    }
    else{
        jQuery( "#anno_classification" ).autocomplete({
            source : islandora_canvas_params.categories
        });
    }
    if(islandora_canvas_params.islandora_anno_use_title_vocab == 1){
        jQuery('#islandora_titles').empty();
        jQuery('<label for="anno_title">Title:</label>').appendTo('#islandora_titles');
        var titles = jQuery('<select  id="anno_title">').appendTo('#islandora_titles');
        titles.append(jQuery("<option>").attr('value','--Choose a type--').text('--Choose a type above to populate--'));
    }

    jQuery("#anno_classification").change(function()
    {
        if(islandora_canvas_params.islandora_anno_use_title_vocab == 1){
            var id=jQuery(this).val();
            var base_url = islandora_canvas_params.islandora_base_url + 'islandora/anno/solr/title/terms/';
            jQuery.getJSON(base_url + id,{
                id : jQuery(this).val(),
                ajax : 'true'
            }, function(j){
                var options = '<option value="nothing">--Select from ' + id + '--</option>';
                for (var i = 0; i < j.length; i++){
                    var fieldName, objectPid;
                    jQuery.each(j[i], function (key, val){
                        if(key =='PID'){
                            objectPid = val;
                        } else {
                            fieldName = val;
                        }
                    });
                    options += '<option value="' + objectPid + '">' + fieldName + '</option>';
                }
                if(j.length == 0){
                    jQuery('#islandora_titles').empty();
                    jQuery('#islandora_titles').append('<label for"anno_title">Title:</label>');
                    jQuery('#islandora_titles').append('<input id="anno_title" type="text" size="28"/>');
                }
                else {
                    jQuery('#islandora_titles').empty();
                    jQuery('<label for="anno_title">Title:</label>').appendTo('#islandora_titles');
                    var titles = jQuery('<select  id="anno_title">').appendTo('#islandora_titles');
                    titles.append(jQuery("<option>").attr('value','--Choose a type--').text('--Choose a type above to populate--'));
                    jQuery('#anno_title').html(options);
                    jQuery("#anno_title").change(function()
                    {
                        var id = jQuery(this).val();
                        var mads_url = islandora_canvas_params.islandora_base_url + 'islandora/anno/mads/';
                        jQuery.getJSON(mads_url+id,{
                            id : jQuery(this).val(),
                            ajax : 'true'
                        }, function(mads){
                            var mads_text = "";
                            jQuery.each(mads, function(i, val) {
                                mads_text += i +': ' +val + '\n\n';
                            });
                            jQuery('#anno_text').val(mads_text);
                        });
                    });
                }
            });
        }
    });
    
    var stroke_widths = islandora_canvas_params.islandora_anno_stroke_widths.split(" ");
    var s_options = "";
    for (var i = 0; i < stroke_widths.length; i++) {
      s_options += '<option value="'+ stroke_widths[i] + '">' + stroke_widths[i] + '</option>';
    }
    jQuery('#stroke-width-wrapper').empty();
    jQuery('#stroke-width-wrapper').append('<label for"stroke_width">Stroke Width:</label>');
    jQuery('#stroke-width-wrapper').append('<select id="stroke_width" />');
    jQuery('#stroke_width').append(s_options);
    
    // RDF Initializationc
    var rdfbase = jQuery.rdf(opts);
    topinfo['query'] = rdfbase;

    var l = jQuery(location).attr('hash');
    var uriparams = {};
    var nCanvas = 1;
    var start = 0;
    if (l[0] == '#' && l[1] == '!') {
        // Process initialization
        var params = l.substr(2,l.length).split('&');
        for (var p=0,prm;prm=params[p];p++) {
            var tup = prm.split('=');
            var key = tup[0];
            var val = tup[1];
            if (key == 's') {
                start = parseInt(val);
                uriparams['s'] = start;
            }
            else if (key == 'n') {
                nCanvas = parseInt(val);
                uriparams['n'] = nCanvas;
            }
        }
    }
    topinfo['uriParams'] = uriparams
    // Initialize UI
    init_ui();
    // Setup a basic Canvas with explicit width to scale to from browser width
    initCanvas(nCanvas);

    // Manifest initialization.
    fetchTriples(islandora_canvas_params.manifest_url,
                 rdfbase,
                 cb_process_manifest);
    resizeCanvas();
});
