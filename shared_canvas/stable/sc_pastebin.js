
//add annotation to fedora

function islandora_postData(title, data, type, color) {
    data = encodeURI(data);
    jQuery.ajax({
        type:'POST',
        async:true,
        url:islandora_canvas_params.islandora_post_url,
        data: {
            title:title,
            data:data,
            type:type,
            color:color,
            strokeWidth: jQuery('#stroke_width').val()
        },
        success: function(pid,status,xhr) {
            islandora_getAnnotation(pid);
        },
        error: function(data,status,xhr) {
            alert('Failed to post');
        }
    });

}

// Adds divs for each type
//
function islandora_getList() {
    islandora_canvas_params.mappings = new Array();
    islandora_canvas_params.strokeWidth = new Array();
    jQuery.ajax({
        type:'GET',
        async:true,
        url: islandora_canvas_params.get_annotation_list_url,
        success: function(data,status,xhr) {
            var listdata = data;
            var pids = listdata.pids;
            if( pids != null){
                for (var i=0;i < pids.length;i++){
                    islandora_canvas_params.mappings[pids[i]['urn']] = pids[i]['color'];
                    islandora_canvas_params.strokeWidth[pids[i]['urn']] = pids[i]['strokeWidth'];
                    var temp = pids[i]['type'];
                    var fixed_cat = temp.replace(/[^\w]/g,'');
                    if(temp != type){
                        var type_class = "annoType_" + fixed_cat;
                        var blockId = 'islandora_annoType_'+ fixed_cat;
                        var contentId = 'islandora_annoType_content_'+ fixed_cat;
                        var idSelector = '#' + blockId;
                        if(jQuery(idSelector).length == 0){
                            header =  '<div class = "islandora_comment_type" id = "'+ blockId + '">';
                            header += '<div class = "islandora_comment_type_title">' + temp + '</div>';
                            header += '<div class = "islandora_comment_type_content" style = "display:none" id = "'+ contentId + '"></div>';
                            header += '</div>';
                            jQuery('#comment_annos_block').append(header);
                        }
                    }
                    var cnv = jQuery(this).attr('canvas');
                    var type = temp;
                }
            if( listdata!= null && pids != null){
                for (var i=0;i < pids.length;i++){
                  islandora_canvas_params.mappings[pids[i]['urn']] = pids[i]['color'];
                  islandora_getAnnotation(pids[i]['id']);
                }
              }
            }
            jQuery(".islandora_comment_type_title").off();
            jQuery(".islandora_comment_type_title").ready().on("click", function(){
                jQuery(this).siblings('.islandora_comment_type_content').toggle();
            });
        },
        error: function(data,status,xhr) {
        }
    });
}


// get annotation data from Fedora and send it to load_comment_anno to be displayed
function islandora_getAnnotation(pid) {
  jQuery.ajax({
    type:'GET',
    url: islandora_canvas_params.islandora_get_annotation + pid,
    success: function(data,status,xhr) {
      load_commentAnno(data);
    },
    error: function(data,status,xhr) {
    }
  });
}

function islandora_deleteAnno(urn) {

    var selector = '#anno_'+urn;
    $parent = jQuery(selector).closest('.islandora_comment_type');
    length = $parent.find('.canvas_annotation').length;

    if (length ==1){
        $parent.remove();
    }

    var classSelector = '.svg_'+urn;
    jQuery.ajax({
        type:'POST',
        url:islandora_canvas_params.islandora_delete_annotation + urn,
        data: urn,
        success: function(data,status,xhr) {
            jQuery(selector).next().remove();
            jQuery(selector).remove();
            jQuery(classSelector).remove();

        },
        error: function(data,status,xhr) {
        }
    });
}


function islandora_updateAnno(urn, title,annoType, content, color){
    jQuery.ajax({
        type:'POST',
        url:islandora_canvas_params.islandora_update_annotation,
        data: {
            urn:urn,
            title:title,
            annoType:annoType,
            content:content,
            color:color,
            strokeWidth: jQuery('#stroke_width').val()
        },
        success: function(data,status,xhr) {
            jQuery('#create_annotation_box').hide();
            var selector = '#anno_'+urn;
            var text = jQuery(selector).text().trim().substring(2,100);
            old_title = jQuery(selector).html();
            new_title = old_title.replace(text, title);
            islandora_canvas_params.strokeWidth['urn:uuid:'+urn] = jQuery('#stroke_width').val();

            jQuery(selector).html(new_title);
            jQuery(selector).next('.comment_text').find('.comment_type').text(annoType);
            jQuery(selector).next('.comment_text').find('.comment_content').text(content);
            var fixed_cat = annoType.replace(/[^\w]/g,'');

            $annotation = jQuery(selector).closest('.canvas_annotation');
            $destination = jQuery('#islandora_annoType_content_' + fixed_cat);
            $annotation.appendTo($destination);
       
            jQuery('#create_annotation').empty().append('Annotate');
            jQuery('#create_annotation').css({
                color:'#000000'
            });
            jQuery('#canvases .canvas').each(function() {
                cnv = jQuery(this).attr('canvas');
                destroyAll(cnv);
            });
            //reset all the annos in the columns so things are consistent.
             
            jQuery('#create_annotation_box').hide();
            
            jQuery('.comment_text').each(function(i, el) {
                jQuery(el).hide();
            });
            jQuery('.comment_title').each(function(i, el) {
                jQuery(el).toggleClass('annotation-opened');
            });
            jQuery('.comment_showhide').each(function(i, el) {
                jQuery(el).text('+ ');
            });  
            jQuery('.mycolor').each(function(i, el) {
                jQuery(el).hide();
            }); 
               
        },
        error: function(data,status,xhr) {
            alert('Failed to update annotation')
        }
    });
  
}