/**
 * @file
 * Defines the Islandora Image Annotation widget and it's Drupal behaviour.
 *
 * Requires jQuery 1.7+.
 * Requires jQuery UI.
 */
(function ($) {
  'use strict';

  /**
   * Initialize the Create Annotation Dialog Box.
   *
   * We can only have one Create Annotation Dialog Box per page.
   */
  Drupal.behaviors.islandoraImageAnnotationCreateAnnotationDialog = {
    attach: function (context, settings) {
      var base = '#islandora-image-annotation-create-annotation-dialog';
      $(base, context).once('islandoraImageAnnotationCreateAnnotationDialog', function () {
        Drupal.IslandoraImageAnnotationCreateAnnotationDialog[base] = new Drupal.IslandoraImageAnnotationCreateAnnotationDialog(base, settings.islandoraImageAnnotationCreateAnnotationDialog);
      });
    }
  };

  /**
   * Instantiate the Create Annotation Dialog Box.
   *
   * @param {string} base
   *   The id of the html element in which to bind the dialog box to.
   *
   * @param {object} settings
   *   The Drupal.settings variable for this widget.
   *   - canSelectColour: boolean, indicates the user can choose the color of
   *     the annotation.
   *   - canLinkEntity: boolean, indicates the user can link an existing entity
   *     to the annotation.
   *
   * @constructor
   */
  Drupal.IslandoraImageAnnotationCreateAnnotationDialog = function (base, settings) {
    // Private Variables.
    var that = this;

    /**
     * Replaces the defined '%pid%' placeholder in the url so that it will
     *
     * @param url
     *   A url typically one from settings.urls.
     * @param pid
     *   An object identifier to use in the defined placeholder.
     *
     * @returns {string}
     *   A resolvable url which includes the given pid.
     */
    function insertPIDinURL(url, pid) {
      return url.replace('%pid%', pid);
    }

    /**
     * Fetches a random color from the 'svgAreaColors' table.
     *
     * @returns {string}
     */
    function getRandomColour() {
      var svgAreaColors = [
        '#FF0000', '#FF6600', '#FF9400', '#FEC500', '#FFFF00', '#8CC700',
        '#0FAD00', '#00A3C7', '#0064B5', '#0010A5', '#6300A5', '#C5007C'];
      return svgAreaColors[Math.floor(Math.random() * svgAreaColors.length)];
    }

    /**
     * Takes a Date object and converts it into an ISO formatted date.
     *
     * @param {Date} date
     *
     * @returns {string}
     */
    function isoDate(date) {
      var dt = date.getUTCFullYear().toString(),
        m = (date.getUTCMonth() + 1).toString(),
        dy = date.getUTCDate().toString(),
        hr = date.getUTCHours().toString(),
        mn = date.getUTCMinutes().toString(),
        sc = date.getUTCSeconds().toString();
      m = m.length === 1 ? '0' + m : m;
      dy = dy.length === 1 ? '0' + dy : dy;
      hr = hr.length === 1 ? '0' + hr : hr;
      mn = mn.length === 1 ? '0' + mn : mn;
      sc = sc.length === 1 ? '0' + sc : sc;
      return dt + '-' + m + '-' + dy + ' ' + hr + ':' + mn + ':' + sc + ' UTC';
    }

    /**
     * Maps the given DOMNode to an SVG XML string.
     *
     * @param {DOMNode} node
     *
     * @returns {string}
     */
    function nodeToSVG(node) {
      var SVG_NS = 'http://www.w3.org/2000/svg',
        name = node.nodeName,
        attributes;
      attributes = $.map(node.attributes, function (attribute) {
        return attribute.nodeName + "='" + attribute.nodeValue + "'";
      });
      attributes.push(" xmlns:svg='" + SVG_NS + "' ");
      return '<svg:' + name + ' ' + attributes.join(' ') + '></svg:' + name + '>';
    }

    /**
     * Generates RDFa representing the annotation the user has created.
     *
     * The parameters define the information the user has provided in the create
     * annotation form and the canvas and shapes they have drawn.
     *
     * All the parameters are required. Except entityID, entityLabel which are
     * optional.
     *
     * @param title
     * @param type
     * @param entityID
     * @param entityLabel
     * @param color
     * @param content
     * @param canvas
     * @param shapes
     *
     * @returns {object}
     *  - annotationID: The uuid that identifies this annotation.
     *  - contentID: The uuid that identifies this annotations content.
     *  - rdfa: A html rdfa representation of this annotation
     */
    function createAnnotation(title, type, entityID, entityLabel, color, content, canvas, shapes) {
      var namespaces, xmlns, rdfa, annotationUUID, contentUUID;
      namespaces = {
        dc: 'http://purl.org/dc/elements/1.1/',
        dcterms: 'http://purl.org/dc/terms/',
        dctype: 'http://purl.org/dc/dcmitype/',
        oa: 'http://www.w3.org/ns/openannotation/core/',
        cnt: 'http://www.w3.org/2008/content#',
        dms: 'http://dms.stanford.edu/ns/',
        rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        ore: 'http://www.openarchives.org/ore/terms/',
        exif: 'http://www.w3.org/2003/12/exif/ns#'
      };
      // We build the rdfa as a string.
      rdfa = '';
      annotationUUID = new UUID();
      contentUUID = new UUID();

      // Generate namespaces from RDF options
      xmlns = $.map(namespaces, function (value, key) {
        return 'xmlns:' + key + '="' + value + '"';
      });

      // Build the RDFa, open the Root Tag.
      rdfa = '<div ' + xmlns.join(' ') + '>'; // Open Root Div

      // Build Annotation, include UUID and type and creation date.
      rdfa += '<div about="urn:uuid:' + annotationUUID + '"> '; // Open Annotation Div
      rdfa += ('<a rel="rdf:type" href="' + namespaces.oa + 'Annotation' + '"></a>');
      rdfa += '<span property="dcterms:created" content="' + isoDate(new Date()) + '"></span> ';

      // Include the linked entity if defined.
      if (typeof entityID === 'string' && entityID !== '') {
        rdfa += '<span property="dcterms:relation" content="' + entityID + '"></span>';
        rdfa += '<span property="dcterms:hasPart" content="' + entityLabel + '"></span>';
      }

      // Include title / type.
      rdfa += '<span property="dc:title" content="' + title + '"></span>';
      rdfa += '<span property="dc:type" content="' + type + '"></span>';

      // Include the actual annotation field's content.
      rdfa += '<a rel="oa:hasBody" href="urn:uuid:' + contentUUID + '"></a>';
      rdfa += '<div about="urn:uuid:' + contentUUID + '">'; // Open Body Div
      rdfa += '<a rel="rdf:type" href="http://www.w3.org/2008/content#ContentAsText"></a>';
      rdfa += '<span property="cnt:chars">' + content + '</span> ';
      rdfa += '<span property="cnt:characterEncoding" content="utf-8"></span>';
      rdfa += '</div>'; // Close Body Div

      // Include shape SVG data.
      shapes.each(function (shape) {
        var svgXml, constrainedTargetUUID, svgConstraintUUID;
        svgXml = nodeToSVG(shape.node);
        constrainedTargetUUID = new UUID();
        svgConstraintUUID = new UUID();
        svgXml = svgXml.replace("stroke='#000000'", "stroke='" + color +  "'");
        // Escape html entities, probably could use some core
        // javascript for this.
        svgXml = svgXml.replace('<', '&lt;');
        svgXml = svgXml.replace('<', '&lt;');
        svgXml = svgXml.replace('>', '&gt;');
        svgXml = svgXml.replace('>', '&gt;');
        rdfa += '<a rel="oa:hasTarget" href="urn:uuid:' + constrainedTargetUUID + '"></a>';
        rdfa += '<div about="urn:uuid:' + constrainedTargetUUID + '">';
        rdfa += '<a rel="rdf:type" href="http://www.w3.org/ns/openannotation/core/ConstrainedTarget"></a>';
        rdfa += '<a rel="oa:constrains" href="' + canvas + '"></a>';
        rdfa += '<a rel="oa:constrainedBy" href="urn:uuid:' + svgConstraintUUID + '"></a>';
        rdfa += '<div about="urn:uuid:' + svgConstraintUUID + '">';
        rdfa += '<a rel="rdf:type" href="http://www.w3.org/ns/openannotation/core/SvgConstraint"></a>';
        rdfa += '<a rel="rdf:type" href="http://www.w3.org/2008/content#ContentAsText"></a>';
        rdfa += '<span property="cnt:chars" content="' + svgXml + '"></span>';
        rdfa += '<span property="cnt:characterEncoding" content="utf-8"></span>';
        rdfa += "</div>"; // Close Constraint
        rdfa += "</div>"; // Close Constrained Target
      });
      rdfa += "</div>"; // Close Annotation
      rdfa += "</div>"; // Close Root
      return {
        annotationID: annotationUUID,
        contentID: contentUUID,
        rdfa: rdfa
      };
    }

    /**
     * Creates an Annotation Object within Fedora from the data provided.
     *
     * @param {string} objectPid
     *   The object identifier in which to add the annotation to, note that a
     *   new annotation object is created as a child of this one.
     * @param {string} title
     *   The annotation's title.
     * @param {string} rdfa
     *   An rdfa xml encoded representation of the annotation.
     * @param {string} type
     *   The type of the annotation.
     * @param {string} color
     *   The color of the annotation shape.
     */
    function addAnnotationToObject(objectPid, title, rdfa, type, color) {
      $.ajax({
        type: 'POST',
        async: true,
        url: insertPIDinURL(settings.urls.addAnnotation, objectPid),
        data: {
          title: title,
          data: encodeURI(rdfa),
          type: type,
          color: color,
          strokeWidth: $('#stroke_width').val()
        },
        success: function (annotationPid, status, xhr) {
          // We successfully created a new annotation, it's content is slightly
          // different than what we posted as the server does some processing of
          // the posted data, so we have to make an additional request to get
          // the annotation again if we want to use it.
          $(Drupal.IslandoraImageAnnotation).trigger('IslandoraImageAnnotation.AddAnnotation', {
            objectPid: objectPid,
            annotationPid: annotationPid
          });
          // @todo Remove.
          // getAnnotation(annotationPid);
        },
        error: function (data, status, xhr) {
          // @todo Better error handling.
          alert('Failed to Create Annotation for: ' + objectPid);
        }
      });
    }

    /**
     * Fetches the html rdfa representation of the annotation.
     *
     * This function is async
     *
     * @param {string} pid
     *   Get pid of the annotation object to be fetched from Fedora.
     */
    function getAnnotation(pid) {
      $.ajax({
        type: 'GET',
        url: insertPIDinURL(settings.urls.getAnnotation, pid),
        success: function (data, status, xhr) {
          // @todo
          // load_commentAnno(data);
        },
        error: function (data, status, xhr) {
          // @todo Better error handling.
          alert('Failed to Get the Annotation: ' + pid);
        }
      });
    }

    /**
     * Creates a dialog box and displays it.
     *
     * @returns {*}
     */
    this.show = function () {
      $(base).dialog({
        title: Drupal.t('Annotate'),
        height: 470,
        width: 380,
        resizable: false,
        closeOnEscape: false,
        modal: true,
        open: function () {
          var randomColour;
          if (settings.canChooseColour) {
            randomColour = getRandomColour();
            $('#anno_color').attr('value', randomColour);
            $('.miniColors-trigger').css('background-color', randomColour);
            $('#color-picker-wrapper').hide();
            $('.color-picker').miniColors();
          }
        },
        buttons: [{
          text: 'Save',
          // Assumes only one canvas with a valid 'canvas' attribute.
          click: function () {
            var $title, title, content, type, color, canvas, shapes, annotation;

            $title = $('#islandora-image-annotation-create-annotation-title');
            title = $title.is('select') ? $('option:selected', $title).val() : $title.val();
            content = $('#islandora-image-annotation-create-annotation-text').val();
            type = $('#islandora-image-annotation-create-annotation-type').val();
            color = $('#islandora-image-annotation-create-annotation-color').attr('value');
            canvas = $('#canvases').find('.canvas[canvas]').attr('canvas');
            shapes = topinfo.raphaels.comment[canvas].annotateRect.myShapes;

            // Minimally we only allow users to create content if they have
            // entered a title and annotation.
            if (!content || !title) {
              alert('An annotation needs both title and content');
              return 0;
            }
            // Also the user must have actually marked up the image.
            if (canvas === null) {
              alert('You must draw a shape around the target.');
              return 0;
            }

            // Set default type if not specified.
            type = (type === '' || type === null) ? Drupal.t('unclassified') : type;

            // @todo Entity Linking.

            // Create RDFa representing the current annotation, all the
            // parameters are required. Except entityID, entityLabel, it also
            // generates identifiers for the annotation and it's content.
            annotation = createAnnotation(title, type, null, null, color, content, canvas, shapes);
            addAnnotationToObject(settings.pid, canvas, annotation.rdfa, type, color);
            $(this).dialog('close');

            // @todo
            // This is adding something to the tab section, this should be moved
            // to be a listening event.
            /*
            var fixed_cat = type.replace(/[^\w]/g, '');
            var blockId = 'islandora_annoType_'+ fixed_cat;
            var contentId = 'islandora_annoType_content_'+ fixed_cat;


            var idSelector = '#' + blockId;

            if ($(idSelector).length == 0) {
              header =  '<div class = "islandora_comment_type" id = "'+ blockId + '">';
              header += '<div class = "islandora_comment_type_title">' + type + '</div>';
              header += '<div class = "islandora_comment_type_content" style = "display:none" id = "'+ contentId + '"></div>';
              header += '</div>';
              $('#comment_annos_block').append(header);
            }
            // add new categories to type ahead if necessary
            if($.inArray(type, islandora_canvas_params.categories) == -1){
              islandora_canvas_params.categories.push(type);
              $( "#anno_classification" ).autocomplete({
                source: islandora_canvas_params.categories
              });
            }
            $(".islandora_comment_type_title").off();
            $(".islandora_comment_type_title").ready().on("click", function () {
             $(this).siblings('.islandora_comment_type_content').toggle();
            });
            */
            // @end todo
            /*
            addAnnotationToObject(settings.pid, canvas, annotation.rdfa, type, color);

            return {
              Target: canvas,
              Type: type,
              Colour: color,
              uuid: annotation.annotationID
            };*/

            // @todo
            /*var hiddenEntity = $('#hidden_entity'),
             hiddenAnnotationType = $('#hidden_annotation_type');
             // @todo Link this.
             if (saveAndEndAnnotating() !== 0) {
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
             }*/
          }
        }, {
          text: 'Cancel',
          click: function () {
            // @todo
            // closeAndEndAnnotating();
            $(this).dialog('close');
            //$('#hidden_annotation_type').text('');
          }
        }]
      });
    };

    // @todo This is temporary and will be in the other file.
    // Link the 'Annotate' Button to displaying the Create Annotation Dialog box.
    $('#create_annotation').click(function () {
      that.show();
    });
  };
}(jQuery));

//
// XXX Need author info in annotations
// Plus other XXXs (!)

// Raphael overwrites CSS with defaults :(
/*

var outsideStyle = islandora_getOutsideStyle()

var insideStyle = {
  fill: '#FFFFFF',
  opacity: 0.3,
  'stroke-width': 'none',
  stroke: 'black',
  'stroke-dasharray': '- '
};

function fetch_comment_annotations() {
  islandora_getList();

}

function maybe_config_create_annotation() {
  $('#create_annotation').click(startAnnotating);
  $('#cancelAnno').click(closeAndEndAnnotating);
  $('#saveAnno').click(saveAndEndAnnotating);

  $('.annoShape').click(function() {
    var typ = $(this).attr('id').substr(10,5);
    topinfo['svgAnnoShape'] = typ;
    $('.annoShape').css('border', '0px');
    $(this).css('border', '1px solid black');
  });

  var shp = $('.annoShape').filter(':first');
  shp.css('border', '1px solid black');
  if(shp != null) {
    topinfo['svgAnnoShape'] = shp.attr('id').substr(10,5);
  }
}

function startAnnotating() {
  $('#anno_color_activated').attr('value', '');
  if ($('#create_annotation').text() == 'Annotating') {
    return;
  }
  $('#saveAnno').html('<span class="ui-button-text">Save</span>');
  $('#create_annotation').css({
    color:'#808080'
  });
  $('#create_annotation').empty().append('Annotating');
  $('#create_annotation_box').dialog('open');
  $('.ui-widget-overlay').remove();
  $('#canvases .canvas').each(function() {
    var cnv = $(this).attr('canvas');
    initForCreate(cnv);
  });
}

function startEditting(title, annotation, annoType, urn) {
  $('#anno_color_activated').attr('value', '');
  if ($('#create_annotation').text() == 'Annotating') {
    return;
  }

  $('#create_annotation').css({
    color:'#808080'
  });
  $('#create_annotation').empty().append('Annotating');
  $('#create_annotation_box').dialog('open');
  $('.ui-widget-overlay').remove();

  $('#anno_title').val(title);
  $('#anno_text').val(annotation);
  $('#anno_classification').val(annoType);
  $('#saveAnno').html('<span class="ui-button-text">Update Annotation</span>');
  $('#saveAnno').attr('urn', urn);
  $('#canvases .canvas').each(function() {
    var cnv = $(this).attr('canvas');
    initForCreate(cnv);
  });
}
function saveAndEndAnnotating() {
  var okay = saveAnnotation();
  if (okay) {
    closeAndEndAnnotating();
    // After rebuild, resize.
    resizeCanvas();
  }
  return okay;
}

function closeAndEndAnnotating() {

  $('#create_annotation').empty().append('Annotate');
  $('#create_annotation').css({
    color:'#000000'
  });
  $('#canvases .canvas').each(function() {
    cnv = $(this).attr('canvas');
    destroyAll(cnv);
  });
  //destroy or hide all annos both render and block represtentations
  $('.comment_text').each(function(i, el) {
    $(el).hide();
  });
  $('.comment_title').each(function(i, el) {
    $(el).toggleClass('annotation-opened');
  });
  $('.comment_showhide').each(function(i, el) {
    $(el).text('+ ');
  });
  $('.mycolor').each(function(i, el) {
    $(el).hide();
  });
  $('#create_annotation_box').dialog('close');

  // empty fields
  $('#anno_title').val('');
  $('#anno_text').val('');
  $('#anno_aboutCanvas').prop('checked', false);
  $('#anno_isResource').prop('checked', false);
  var tabs = $('#tabs').tabs();
  tabs.tabs('select', 3);


}

//We do creation by trapping clicks in an invisible SVG box
//This way we have the dimensions without messing around
//converting between page clicks and canvas clicks

function initForCreate(canvas) {
  var r = mk_raphael('comment', canvas, topinfo['canvasDivHash'][canvas]);
  var invScale = 1.0 / r.newScale;
  var ch = Math.floor(r.height * invScale);
  var cw = Math.floor(r.width * invScale);
  var prt = r.wrapperElem;
  // Ensure we're above all painting annos
  $(prt).css('z-index', 1001);
  var bg = r.rect(0,0,cw,ch);
  bg.attr({
    'fill': 'white',
    'opacity': 0.15
  });
  bg.creating = null;
  bg.invScale = invScale;
  bg.myPaper = r;
  bg.myShapes = [];
  r.annotateRect = bg;
  bg.drag(function(dx,dy) {
    this.creating.resizeFn(dx, dy);
  }, switchDown, switchUp);
}

function destroyAll(canvas) {
  if ( topinfo['raphaels']['comment'][canvas]){
    var r = topinfo['raphaels']['comment'][canvas];
    var bg = r.annotateRect;
    if(bg){
      for (var x in bg.myShapes) {
        var sh = bg.myShapes[x];
        if (sh.set != undefined) {
          sh.set.remove();
        } else {
          sh.remove();
        }
      };
      bg.remove();
    }
    $(r.wrapperElem).remove();
    $(r).remove();
  }
  topinfo['raphaels']['comment'][canvas] = undefined;
}

function saveAnnotation() {
  // Basic Sanity Check
  var title = $('#anno_title').val();
  if($("#anno_title").get(0).tagName == 'SELECT'){
    //if title is a select box we want the title not the pid
    title = $('#anno_title option:selected').text();
  }
  var content = $('#anno_text').val();
  var annoType = $('#anno_classification').val();
  var color = '';

  //check to see if color box has been activated
  color = $('#anno_color').attr('value');
  if($('#hidden_annotation_type').attr('anno_type') == 'Update Annotation'){
    urn = $('#hidden_annotation_type').attr('urn');
    islandora_updateAnno(urn, title, annoType, content, color);
    return;
  }
  if (!content || (!title && typ == 'comment')) {
    alert('An annotation needs both title and content');
    return 0;
  }

  // Create
  var rinfo = create_rdfAnno();
  var rdfa = rinfo[0];
  var tgt = rinfo[1];
  if (tgt == null) {
    alert('You must draw a shape around the target.');
    return 0;
  }

  // Save
  var data = $(rdfa).rdf().databank.dump({
    format:'text/turtle',
    serialize:true
  });
  var type = $('#anno_classification').val();
  // add category to annoblock before saving annotation.  Fixes concurrency errors
  if(type == '') {
    type = 'unclassified';
  }
  var fixed_cat = type.replace(/[^\w]/g,'');

  var type_class = "annoType_" + fixed_cat;
  var blockId = 'islandora_annoType_'+ fixed_cat;
  var contentId = 'islandora_annoType_content_'+ fixed_cat;

  var dt = data.split("<urn:uuid:");
  var split_dt = dt[1].split('>');
  var idSelector = '#' + blockId;

  if($(idSelector).length == 0){
    header =  '<div class = "islandora_comment_type" id = "'+ blockId + '">';
    header += '<div class = "islandora_comment_type_title">' + type + '</div>';
    header += '<div class = "islandora_comment_type_content" style = "display:none" id = "'+ contentId + '"></div>';
    header += '</div>';
    $('#comment_annos_block').append(header);
  }
  // add new categories to typeahead if necessary
  if($.inArray(type, islandora_canvas_params.categories) == -1){
    islandora_canvas_params.categories.push(type);
    $( "#anno_classification" ).autocomplete({
      source: islandora_canvas_params.categories
    });
  }

  // Updated backport fix. Add's click handler to new annotations,
  // Making them available.
  islandora_postData(tgt, rdfa, type, color);
  $(".islandora_comment_type_title").off();
  $(".islandora_comment_type_title").ready().on("click", function(){
    $(this).siblings('.islandora_comment_type_content').toggle();
  });

  var data = {};
  data.Target = tgt;
  data.Type = type;
  data.Colour = color;
  data.uuid = split_dt[0];
  return data;
}

function nodeToXml(what) {
  // MUST use 's as in attribute on span
  var xml = '<svg:' + what.nodeName + " xmlns:svg='" + SVG_NS +"' ";
  for (a in what.attributes) {
    var attr = what.attributes[a];
    if (attr.nodeName != undefined) {
      xml += (attr.nodeName + "='"+attr.nodeValue+"' ");
    }
  }
  xml += ("></svg:" + what.nodeName+'>');
  return xml;
}

function switchDown(x,y) {
  var fixedxy = fixXY(this,x,y);
  var x = fixedxy[0];
  var y = fixedxy[1];
  var which = topinfo['svgAnnoShape'];

  if (which == 'circ') {
    this.creating = mkCircle(this,x,y);
    this.myShapes.push(this.creating);
  } else if (which == 'rect') {
    this.creating = mkRect(this, x,y);
    this.myShapes.push(this.creating);
  } else {
    if (this.creating == null) {
      this.creating = mkPoly(this,x,y);
      this.myShapes.push(this.creating);
    } else {
      this.creating.addPoint(this,x,y);
    }
  }
}

function switchUp(x, y) {
  var which = topinfo['svgAnnoShape'];
  if (which == 'circ') {
    this.creating.start=[];
    this.creating = null;
  } else if (which == 'rect') {
    this.creating.set.start=[];
    this.creating = null;
  }
}

function fixXY(what, x, y) {
  // modify for x,y of wrapper
  var r = what.myPaper;
  var wrap = r.wrapperElem;

  // This is location of canvas
  var offsetLeft = $(wrap).offset().left;
  var offsetTop = $(wrap).offset().top;
  y-= offsetTop;
  x -= offsetLeft;

  // Change made to support embeding shared canvas.
  var pageOffsetTop = $(window).scrollTop();
  var pageOffsetLeft = $(window).scrollLeft();
  y += pageOffsetTop;
  x += pageOffsetLeft;

  // And now scale for Canvas resizing
  x = Math.floor(x * what.invScale);
  y = Math.floor(y * what.invScale);
  return [x,y]
}



function mkGrabber(what,poly,x,y,idx) {
  var myr = Math.floor(10*what.invScale);
  var r = what.myPaper;
  var c = r.circle(x,y,myr);
  c.attr(insideStyle);
  c.pointIdx = idx;
  c.poly = poly;
  poly.set.push(c);
  c.start = [x,y];

  var mdf = function() {
    this.moved = 0;
    this.start = [this.attr("cx"), this.attr("cy")]
  };

  var muf = function() {
    if (what.creating == this.poly && this.pointIdx == 0) {
      what.creating = null;
      this.poly.attr('path', this.poly.attr('path') + 'Z');
    } else if (!this.moved) {
      // delete point
      pth = Raphael.parsePathString(this.poly.attr("path"));
      pth.splice(this.pointIdx, 1);
      this.poly.attr("path", pth);
      // Now shuffle down all subsequent points
      for (var i = this.pointIdx, pt; pt = this.poly.set[i+1]; i++) {
        pt.pointIdx -= 1;
      }
      this.remove();
    }
    this.start = undefined;
  };

  var move = function (dx, dy) {
    dx = Math.floor(dx * what.invScale);
    dy = Math.floor(dy * what.invScale);

    this.attr({
      cx: this.start[0] + dx,
      cy: this.start[1] + dy
    })
    var pathsplit = Raphael.parsePathString(this.poly.attr("path"))
    pathsplit[this.pointIdx][1] = Math.floor(this.start[0]+dx);
    pathsplit[this.pointIdx][2] = Math.floor(this.start[1]+dy);

    this.poly.attr('path', pathsplit);
    this.moved = 1;
  };
  c.moveFn = move;
  c.drag(move, mdf, muf);
  return c;
}

function mkPoly(what, x,y) {

  addPointFn = function(what, x,y) {
    this.attr('path', this.attr('path') + ('L'+x+','+y) );
    c = mkGrabber(what, this, x,y,this.attr('path').length-1);
  };

  var mdf = function() {
    this.set.tmp = [0,0];
  };
  var muf = function() {
    this.set.tmp = undefined;
  };
  var move = function(dx,dy) {
    dx=Math.floor(dx * what.invScale);
    dy=Math.floor(dy * what.invScale);
    this.set.translate(dx-this.set.tmp[0], dy-this.set.tmp[1]);
    this.set.tmp = [dx,dy];
  };
  var resizefn = function(dx,dy) {
    dx=Math.floor(dx * what.invScale);
    dy=Math.floor(dy * what.invScale);
    c = this.set[this.set.length-1];
    c.moveFn(dx,dy);
  };

  var r = what.myPaper;
  var s = r.set();
  var outer = r.path("M" +x + ',' + y);
  var outsideStyle = islandora_getOutsideStyle();
  outer.attr(outsideStyle);
  outer.attr()
  outer.addPoint = addPointFn;
  s.push(outer)
  outer.set = s;

  c = mkGrabber(what,outer,x,y,0);
  outer.drag(move, mdf, muf);
  outer.resizeFn = resizefn;
  outer.dblclick(function() {
    this.set.remove();
  });
  return outer;
}


function mkCircle(what, x,y) {

  innerSize = Math.floor(10 * what.invScale);

  mdf = function() {
    this.start = [this.attr("cx"), this.attr("cy"), this.attr('r')]
  };

  muf = function() {
    this.start = undefined;
  };

  move = function (dx, dy) {
    this.set.attr(
      {
        cx: this.start[0] + Math.floor(dx * what.invScale),
        cy: this.start[1] + Math.floor(dy * what.invScale)
      });
  };

  resize = function(dx, dy) {
    this.attr('r', this.start[2] + Math.floor(dx * what.invScale));
    this.inner.attr('r', this.start[2] + (Math.floor(dx * what.invScale) - innerSize));
  };

  var r = what.myPaper;
  var st = r.set();
  var outer = r.circle(x,y,innerSize);
  var outsideStyle = islandora_getOutsideStyle();
  outer.attr(outsideStyle);
  outer.start = [x,y,innerSize];
  outer.set = st;

  var inner = r.circle(x, y, 0);
  inner.attr(insideStyle);
  inner.toFront();
  inner.set = st;

  st.push(outer);
  st.push(inner);
  outer.inner = inner;

  inner.drag(move, mdf, muf);
  outer.drag(resize, mdf, muf);
  outer.resizeFn = resize;
  inner.dblclick(function() {
    this.set.remove();
  });
  return outer;
}


function mkRect(what, x,y) {

  innerSize = Math.floor(14 * what.invScale);

  mdf = function() {
    this.set.start = [
      Math.floor(this.set.outer.attr('x') ),
      Math.floor(this.set.outer.attr('y') ),
      Math.floor(this.set.outer.attr('height') ),
      Math.floor(this.set.outer.attr('width') )
    ];
  };

  muf = function() {
    this.set.start = undefined;
  };

  move = function(dx, dy) {
    this.set.outer.attr(
      {
        'x': this.set.start[0] + Math.floor(dx * what.invScale),
        'y' : this.set.start[1] + Math.floor(dy * what.invScale)
      });
    this.set.inner.attr(
      {
        'x': this.set.start[0] + this.set.start[3] + Math.floor(dx * what.invScale) - innerSize,
        'y' : this.set.start[1] + this.set.start[2] + Math.floor(dy * what.invScale) - innerSize
      });
  };

  resize = function(dx, dy) {
    this.set.outer.attr(
      {
        'height' : this.set.start[2] + Math.floor(dy * what.invScale),
        'width' : this.set.start[3] + Math.floor(dx * what.invScale)
      });
    this.set.inner.attr(
      {
        'x' : this.set.start[0] + this.set.start[3] + Math.floor(dx * what.invScale) - innerSize,
        'y': this.set.start[1] + this.set.start[2] + Math.floor(dy * what.invScale) - innerSize
      });
  };

  var r = what.myPaper;
  var st = r.set();
  st.start = [x, y, innerSize,innerSize];

  var outer = r.rect(x,y, innerSize,innerSize);
  var outsideStyle = islandora_getOutsideStyle();
  outer.attr(outsideStyle);
  outer.set = st;
  var inner = r.rect(x,y, innerSize+1,innerSize+1);
  inner.attr(insideStyle);
  inner.toFront();
  inner.set = st;

  st.push(outer);
  st.push(inner);
  st.outer = outer;
  st.inner = inner;

  inner.drag(resize, mdf, muf);
  outer.drag(move, mdf, muf);
  outer.resizeFn = resize;
  outer.dblclick(function() {
    this.set.remove();
  });
  return outer;
}

function islandora_getOutsideStyle(){
  var outsideStyle = {
    fill: 'none',
    opacity: 'none',
    'stroke-width': $('#stroke_width').val() + '%' ,
    stroke: $('#anno_color').attr('value')
  };
  return outsideStyle;
}
*/
