/**
 * @file
 * Defines the Islandora Image Annotation widget and it's Drupal behaviour.
 */
(function ($) {
  'use strict';
  Drupal.IslandoraImageAnnotation = Drupal.IslandoraImageAnnotation || {};

  /**
   * Initialize the Islandora Image Annotation Widget.
   *
   * We can only have one Islandora Image Annotation widget per page.
   */
  Drupal.behaviors.islandoraImageAnnotation = {
    attach: function (context, settings) {
      $('#image_annotation_wrapper', context).once('islandoraImageAnnotation', function () {
        Drupal.IslandoraImageAnnotation['#image_annotation_wrapper'] = new Drupal.IslandoraImageAnnotation(settings.islandoraImageAnnotation);
      });
    }
  };

  /**
   * Create the Islandora Image Annotation Widget.
   *
   * @param $element
   *   The html element in which we will render the Islandora Image Annotation
   *   Widget.
   * @param settings
   *   Settings to configure the Islandora Image Annotation Widget.
   * @constructor
   */
  Drupal.IslandoraImageAnnotation = function ($element, settings) {
    // Adapted from sc_init of the shared canvas project.
    // @todo Document.
    this.startDate = 0;
    // @todo Document.
    this.timeout = false;
    // @todo Document.
    this.delta = 300;
    // @todo Document.
    this.topinfo = {
      'canvasWidth': 0,    // scaled width of canvas in pixels
      'numCanvases': 0,    // number of canvases to display
      'current': 0,        // current idx in sequence
      'done': [],           // URLs already processed
      'query': null,       // top level databank
      'sequence': [],      // Sequence list
      'sequenceInfo': {},  // uri to [h,w,title]
      'annotations': {
        'image': {},
        'text': {},
        'audio': {},
        'zone': {},
        'comment': {}
      },
      'lists': {
        'image': {},
        'text': {},
        'audio': {},
        'zone': {},
        'comment': {}
      },
      'raphaels': {
        'image': {},
        'text': {},
        'audio': {},
        'zone': {},
        'comment': {}
      },
      'zOrders': {
        'image': 1,
        'detailImage': 1000,
        'text': 2000,
        'audio': 3000,
        'zone': 4000,
        'comment': 5000
      },
      'canvasDivHash': {},
      'builtAnnos': [],
      'paintedAnnos': [],
      'audioAnno': null,
      'waitingXHR': 0
    };
    // @todo Where are these used?
    // var SVG_NS = "http://www.w3.org/2000/svg";
    // var XLINK_NS = "http://www.w3.org/1999/xlink";
    // @todo Document.
    this.opts = {
      // @todo Is this even remotely relevant?
      // base : 'http://localhost/EmicShared/impl/',
      namespaces: {
        dc: 'http://purl.org/dc/elements/1.1/',
        dcterms: 'http://purl.org/dc/terms/',
        dctype: 'http://purl.org/dc/dcmitype/',
        oa: 'http://www.w3.org/ns/openannotation/core/',
        cnt: 'http://www.w3.org/2008/content#',
        dms: 'http://dms.stanford.edu/ns/',
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        ore: 'http://www.openarchives.org/ore/terms/',
        exif: 'http://www.w3.org/2003/12/exif/ns#'
      }
    };

    var svgAreaColors = [
      '#FF0000', '#FF6600', '#FF9400', '#FEC500', '#FFFF00', '#8CC700',
      '#0FAD00', '#00A3C7', '#0064B5', '#0010A5', '#6300A5', '#C5007C'];

    /**
     * Fetches a random color from the 'svgAreaColors' table.
     * @private
     * @returns {string}
     */
    function get_random_color() {
      return svgAreaColors[Math.floor(Math.random() * svgAreaColors.length)];
    }

    /**
     * Initializes the annotation dialog box.
     *
     * @param can_choose_color
     * @returns {jQuery}
     */
    function initAnnotationDialogBox(can_choose_color) {
      // Show 'Annotate' button.
      $('#create_annotation').show();
      // Enable the color-picker if enabled.
      if (can_choose_color) {
        $('#color-picker-wrapper').click(function () {
          $('#anno_color_activated').attr('value', 'active');
        });
        $('.color-picker').miniColors();
      } else {
        $('#color-picker-wrapper').empty();
      }
      // Before creating the dialog box we should first initialize the autocomplete
      // field for entity textfield.
      this.initEntityAutocomplete();
      // Create the annotation box.
      return $('#create_annotation_box').dialog({
        title: 'Annotate',
        resizable: false,
        closeOnEscape: false,
        height: 470,
        width: 380,
        modal: true,
        autoOpenType: false,
        open: function () {
          if (can_choose_color) {
            var random_color = get_random_color();
            $('#anno_color').attr('value', random_color);
            $('.miniColors-trigger').css('background-color', random_color);
            $('#color-picker-wrapper').hide();
          }
        },
        buttons: [
          {
            text: 'Save',
            click: function () {
              var hiddenEntity = $('#hidden_entity'),
                hiddenAnnotationType = $('#hidden_annotation_type');
              // @todo Link this.
              if (saveAndEndAnnotating() != 0) {
                // @todo Link this.
                closeAndEndAnnotating();
                // Reset hidden data for the next time this
                // dialog is used.
                if (hiddenEntity) {
                  $('#hidden_entity').data('entity', '');
                }
                hiddenAnnotationType.attr('anno_type', '');
                hiddenAnnotationType.attr('urn', '');
                $(this).dialog('close');
              }
            }
          },
          {
            text: 'Cancel',
            click: function () {
              closeAndEndAnnotating();
              $annotationDialog.dialog('close');
              $('#hidden_annotation_type').text('');
            }
          }
        ]
      });
    };

    if (settings.can_edit) {
      // @todo Move to a more appropriate place.
      initAnnotationDialogBox(settings.can_choose);
      this.createContextMenu();
    }

    /*

    // @todo Document, this is related to taxonomy.
    if (settings.enableTaxonomy === 1) {
      $('#islandora_classification').empty();
      $('<label for="anno_classification">Type:</label>').appendTo('#islandora_classification');
      var sel = $('<select  id="anno_classification">').appendTo('#islandora_classification');
      $(settings.categories).each(function () {
        var value = this.toString();
        sel.append($("<option>").attr('value', value).text(value));
      });
    } else {
      $("#anno_classification").autocomplete({
        source: settings.categories
      });
    }
    // @todo Another islandora specific thing?
    if (settings.islandora_anno_use_title_vocab === 1) {
      $('#islandora_titles').empty();
      $('<label for="anno_title">Title:</label>').appendTo('#islandora_titles');
      $('<select  id="anno_title">')
        .appendTo('#islandora_titles')
        .append($("<option>")
          .attr('value', '--Choose a type--')
          .text('--Choose a type above to populate--'));
    }
    // @todo More taxonomy related things?
    // This if for the Pop up block there is a section for islandora content.
    // Type field:
    $("#anno_classification").change(function () {
      var id = $(this).val();
      if (settings.islandora_anno_use_title_vocab === 1) {
        // @todo Refactor this is unreadable.
        $.getJSON(Drupal.basePath + 'islandora/anno/solr/title/terms/' + id, {
          id: $(this).val(),
          ajax: 'true'
        }, function (docs) {
          var options = ['<option value="nothing">--Select from ' + id + '--</option>'],
            $titles = $('#islandora_titles');
          options.push($.map(docs, function (doc) {
            return '<option value="' + doc.PID + '">' + doc.label + '</option>';
          }));
          if (docs.length === 0) {
            $titles.empty();
            $titles.append('<label for"anno_title">Title:</label>');
            $titles.append('<input id="anno_title" type="text" size="28"/>');
          } else {
            $titles.empty();
            $('<label for="anno_title">Title:</label>').appendTo('#islandora_titles');
            $('<select  id="anno_title">').appendTo('#islandora_titles')
              .append($("<option>")
                .attr('value', '--Choose a type--')
                .text('--Choose a type above to populate--'));
            $('#anno_title').html(options);
            $("#anno_title").change(function () {
              var id = $(this).val(),
                mads_url = Drupal.basePath + 'islandora/anno/mads/';
              $.getJSON(mads_url + id, {
                id: $(this).val(),
                ajax: 'true'
              }, function (mads) {
                var text = $.map(mads, function (i, val) {
                  return i + ': ' + val + '\n\n';
                });
                $('#anno_text').val(text.join(''));
              });
            });
          }
        });
      }
    });

    var stroke_widths = settings.islandora_anno_stroke_widths.split(" ");
    var s_options = "";
    for (var i = 0; i < stroke_widths.length; i++) {
      s_options += '<option value="' + stroke_widths[i] + '">' + stroke_widths[i] + '</option>';
    }
    $('#stroke-width-wrapper').empty();
    $('#stroke-width-wrapper').append('<label for"stroke_width">Stroke Width:</label>');
    $('#stroke-width-wrapper').append('<select id="stroke_width" />');
    $('#stroke_width').append(s_options);

    // RDF Initializationc
    var rdfbase = $.rdf(this.opts);
    this.topinfo['query'] = rdfbase;

    var l = $(location).attr('hash');
    var uriparams = {};
    var nCanvas = 1;
    var start = 0;
    if (l[0] == '#' && l[1] == '!') {
      // Process initialization
      var params = l.substr(2, l.length).split('&');
      for (var p = 0, prm; prm = params[p]; p++) {
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
    this.topinfo['uriParams'] = uriparams
    // Initialize UI
    this.initUI();
    // Setup a basic Canvas with explicit width to scale to from browser width
    this.initCanvases(nCanvas);

    // Manifest initialization.
    fetchTriples(settings.manifest_url,
      rdfbase,
      cb_process_manifest);
    resizeCanvas();
    */
  };

  /**
   * Swaps out place holder string (%pid) in url with the given pid.
   */
  Drupal.IslandoraImageAnnotation.prototype.urlSwapPid = function (url, pid) {
    return url.replace('%pid%', pid);
  };

  /**
   * Initializes a number of canvases.
   *
   * @param numCanvases
   *   The number of canvases to create.
   */
  Drupal.IslandoraImageAnnotation.prototype.initCanvases = function (numCanvases) {
    var $canvasBody = $('#canvas-body'),
      width = $canvasBody.width(),
      height = $canvasBody.height(),
      x;
    $('#top_menu_bar').width(width - 5);
    for (x = 0; x < numCanvases; x++) {
      if ($('#canvas_' + x).length == -0) {
        $('#canvases').append('<div id="canvas_' + x + '" class="canvas"></div>');
      }
      $canvasBody.width(width);
      $canvasBody.height(height);
    }
    this.topinfo['canvasWidth'] = width;
    this.topinfo['numCanvases'] = numCanvases;
    if (numCanvases > 2) {
      // Default text off if lots of canvases
      $('#check_show_text').attr('checked', false);
    }
  };

  /**
   * @todo
   * Calling this function assumes the user has the ability to edit.
   */
  Drupal.IslandoraImageAnnotation.prototype.initCreateAnnotationDialogBox = function(can_choose_color) {
    // Show 'Annotate' button.
    $('#create_annotation').show();
    // Enable the color-picker if enabled.
    if (can_choose_color) {
      $('#color-picker-wrapper').click(function () {
        $('#anno_color_activated').attr('value', 'active');
      });
      $('.color-picker').miniColors();
    } else {
      $('#color-picker-wrapper').empty();
    }
    // Before creating the dialog box we should first initialize the autocomplete
    // field for entity textfield.
    this.initEntityAutocomplete();
    // Create the annotation box.
    return $('#create_annotation_box').dialog({
      title: 'Annotate',
      resizable: false,
      closeOnEscape: false,
      height: 470,
      width: 380,
      modal: true,
      autoOpenType: false,
      open: function () {
        if (can_choose_color) {
          var random_color = get_random_color();
          $('#anno_color').attr('value', random_color);
          $('.miniColors-trigger').css('background-color', random_color);
          $('#color-picker-wrapper').hide();
        }
      },
      buttons: [
        {
          text: 'Save',
          click: function () {
            var hiddenEntity = $('#hidden_entity'),
              hiddenAnnotationType = $('#hidden_annotation_type');
            // @todo Link this.
            if (saveAndEndAnnotating() != 0) {
              // @todo Link this.
              closeAndEndAnnotating();
              // Reset hidden data for the next time this
              // dialog is used.
              if (hiddenEntity) {
                $('#hidden_entity').data('entity', '');
              }
              hiddenAnnotationType.attr('anno_type', '');
              hiddenAnnotationType.attr('urn', '');
              $(this).dialog('close');
            }
          }
        },
        {
          text: 'Cancel',
          click: function () {
            closeAndEndAnnotating();
            $annotationDialog.dialog('close');
            $('#hidden_annotation_type').text('');
          }
        }
      ]
    });
  };

  /**
   * Sets up the autocomplete field for Entity text field.
   *
   * Entity linking is optional and not necessarily enabled. Calling this function
   * when it is not enabled won't have any affect.
   */
  Drupal.IslandoraImageAnnotation.prototype.initEntityAutocomplete = function () {
    // Enable autocomplete on the Entity text field.
    $('#cboEntityLookup').autocomplete({
      source: function (request, response) {
        var results = {}
        query = $('#cboAddEntity').find('option:selected').text() + '/' + '?entities_query=' + request.term;
        $.ajax({
          url: Drupal.settings.basePath + '/islandora/entities/search/' + query,
          async: false,
          dataType: 'json',
          success: function (data, status, xhr) {
            if ($.isPlainObject(data)) data = [data];
            if (data != null) {
              results = data;
            } else {
              results = [];
            }
          },
          error: function (xhr, status, error) {
            if (status == 'parsererror') {
              var lines = xhr.responseText.split(/\n/);
              if (lines[lines.length - 1] == '') {
                lines.pop();
              }
              var string = lines.join(',');
              var data = $.parseJSON('[' + string + ']');
              results = data;
            } else {
              results = null;
            }
          }
        });
        response($.map(results, function (item) {
          return {
            label: item.identifier,
            value: item.identifier,
            data: item.Object
          };
        }));
      },
      select: function (event, ui) {
        // Add the selected entity data to the hidden
        // 'hidden_entity' field.
        $('#hidden_entity').data('entity', ui.item);
      }
    });
  };

  /**
   * @todo Document
   */
  Drupal.IslandoraImageAnnotation.prototype.initUI = function () {
    // @todo What's this on about.
    /*var anno_d = annotation_dialog();
     anno_d.dialog('close');*/

    // @todo Remove looks like this stuff doesn't exist.
    /*
     $('.dragBox').draggable().resizable();
     $('.dragBox').hide();

     $('.dragShade').click(function() {
     var sh = $(this);
     if (sh.text() == '[-]') {
     sh.empty().append('[+]');
     var p = $(this).parent(); // header
     var h = p.height();
     var pp = p.parent(); // box
     var nh = pp.height();
     sh.attr('ph', nh);
     p.next().hide();
     pp.height(h + 6);
     }
     else {
     var n = sh.parent().next();
     var nh = sh.attr('ph');
     var p = sh.parent().parent();
     p.height(nh);
     sh.empty().append('[-]');
     n.show();
     }
     });*/

    // @todo Remove, this looks to be specific to the CWRC-Writer?
    /*
     $('#loadprogress').progressbar({
     value : 2
     }).css({
     height : 15,
     width : 300,
     opacity : 1.0,
     'z-index' : 10000
     });
     $('#loadprogress').position({
     of : '#create_annotation',
     my : 'left top',
     at : 'right top',
     collision : 'none',
     offset : '10 0'
     })*/

    // @todo Remove, this looks to be specific to the CWRC-Writer?
    // $(".menu_body li:even").addClass("alt");

    // Link to menus.
    $('.menu_head').click(function () {
      // First find our id, and then use to find our menu
      var id = $(this).attr('id');
      var menubody = $('#' + id + '_body')
      menubody.slideToggle('medium');
      menubody.position({
        'of': '#' + id,
        'my': 'top left',
        'at': 'bottom left',
        'collision': 'fit',
        'offset': '0 8'
      })
    });

    try {
      // May not want to allow annotation
      // @todo What the fuck is this on about?
      maybe_config_create_annotation();
    } catch (e) {
      // XXX Remove annotation button and shape menu

    }
    // @todo Part of the dialog?
    $('#color-picker-wrapper').click(function () {
      $('#anno_color_activated').attr('value', 'active');
    });
    // @todo Part of the dialog?
    $('.color-picker').miniColors();
    // Refresh Canvas if browser is resized.
    // We're called as per move... so need wait till finished resizing
    $(window).resize(function () {
      this.resizeCanvas();
    });
  };

  /**
   * @todo Document.
   */
  Drupal.IslandoraImageAnnotation.prototype.resizeCanvas = function () {
    if (this.timeout === false) {
      this.timeout = true;
      this.closeAndEndAnnotating();
      window.setTimeout(this.maybeResize, this.delta);
    }
  };

  /**
   * @todo Document.
   */
  Drupal.IslandoraImageAnnotation.prototype.maybeResize = function () {
    var $baseImage = $('.base_img'),
      $imageElement = $baseImage.children(":first"),
      $annotationWrapper = $('.islandora-anno-wrapper'),
      $adminMenuWrapper = $('#admin-menu-wrapper'),
      canvasBodyWidth = $('#canvas-body').width();
    // @todo What is timeout for?
    this.timeout = false;
    // @todo Why Re-init Canvases on each resize??
    this.initCanvases(this.topinfo['numCanvases']);
    // Set the Image to the full width of the canvas body.
    $imageElement.width(canvasBodyWidth);
    $imageElement.css("height", "auto");
    $baseImage.css("height", $imageElement.height());
    // Set the first canvas to be the full width of the canvas body.
    $('#canvas_0').css("width", canvasBodyWidth);
    // Set the top to zero.
    $annotationWrapper.css('top', 0);
    // Resize in-case we have the Drupal 7 admin menu available.
    // @todo Perhaps this belongs in a different function.
    if ($adminMenuWrapper.length > 0) {
      $annotationWrapper.css('top', $adminMenuWrapper.height());
    }
  };

  /**
   * Creates a context-menu to edit / delete existing annotations.
   */
  Drupal.IslandoraImageAnnotation.prototype.createContextMenu = function () {
    $.contextMenu({
      selector: '.comment_title',
      items: {
        'edit': {
          name: 'Edit Annotation',
          icon: 'edit',
          accesskey: 'e'
        },
        'delete': {
          name: 'Delete Annotation',
          icon: 'delete'
        }
      },
      callback: function (key, options) {
        var title = $(this).text().substring(2, 100).trim(),
          urn = $(this).attr('id').substring(5, 100),
          comment_text = $(this).next('.comment_text'),
          anno_type = comment_text.find('.comment_type').text(),
          annotation = comment_text.find('.comment_content').text(),
          pm = $(this).find('.comment_showhide'),
          id = $(this).attr('id').substring(5, 100),
          $hiddenAnnotationType = $('#hidden_annotation_type');
        // Menu Options.
        switch (key) {
          case 'delete':
            if (confirm("Permanently Delete Annotation '" + title + "'")) {
              // @todo How will we deal with the sc_ functions?
              islandora_deleteAnno(urn);
            }
            break;
          case 'edit':
            // Show the next annotation.
            $(this).addClass('annotation-opened').next().show();
            if (pm.text() === '+ ') {
              pm.empty().append('- ');
              // @todo Link up.
              paint_commentAnnoTargets(this, $(this).attr('canvas'), id);
            }
            $hiddenAnnotationType.attr('anno_type', 'Update Annotation');
            $hiddenAnnotationType.attr('urn', urn);
            // @todo Link up.
            // @todo document.
            startEditting(title, annotation, anno_type, urn);
            break;
        }
      }
    });
  };
}(jQuery));