
//add annotation to fedora

function islandora_postData(title, data, type, color) {
    data = encodeURI(data);
    $.ajax({
        type:'POST',
        async:false,
        url:islandora_canvas_params.islandora_post_url,
        data: {
            title:title,
            data:data,
            type:type,
            color:color,
            strokeWidth: $('#stroke_width').val()
        },
        success: function(data,status,xhr) {
            islandora_getAnnotation(data);
        },
        error: function(data,status,xhr) {
            alert('Failed to post')
        }
    });

}

// Adds divs for each type
//
function islandora_getList() {
  islandora_canvas_params.mappings = new Array();
  islandora_canvas_params.strokeWidth = new Array();
    for (var key in islandora_canvas_params.anno_data){
      islandora_canvas_params.anno_data[key].obj_data.urn
      islandora_canvas_params.mappings[islandora_canvas_params.anno_data[key].obj_data.urn] = islandora_canvas_params.anno_data[key].obj_data.color;
      islandora_canvas_params.strokeWidth[islandora_canvas_params.anno_data[key].obj_data.urn] = islandora_canvas_params.anno_data[key].obj_data.strokeWidth;
      var type_class = "annoType_" + islandora_canvas_params.anno_data[key].obj_data.type;
      var blockId = 'islandora_annoType_'+ islandora_canvas_params.anno_data[key].obj_data.type;
      var contentId = 'islandora_annoType_content_'+ islandora_canvas_params.anno_data[key].obj_data.type;
      var idSelector = '#' + blockId;
      if($(idSelector).length == 0){
        header =  '<div class = "islandora_comment_type" id = "'+ blockId + '">';
        header += '<div class = "islandora_comment_type_title">' + islandora_canvas_params.anno_data[key].obj_data.type + '</div>';
        header += '<div class = "islandora_comment_type_content" style = "display:none" id = "'+ contentId + '"></div>';
        header += '</div>';
        $('#comment_annos_block').append(header);
      }
      islandora_getAnnotation(islandora_canvas_params.anno_data[key].anno_data);
    }
  $(".islandora_comment_type_title").off();
  $(".islandora_comment_type_title").ready().on("click", function(){
    $(this).siblings('.islandora_comment_type_content').toggle();
  });
}


// get annotation data from Fedora and send it to load_comment_anno to be displayed
function islandora_getAnnotation(data) {
  load_commentAnno(data);
}

function islandora_deleteAnno(urn) {

    var selector = '#anno_'+urn;
    $parent = $(selector).closest('.islandora_comment_type');
    length = $parent.find('.canvas_annotation').length;

    if (length ==1){
        $parent.remove();
    }

    var classSelector = '.svg_'+urn;
    $.ajax({
        type:'POST',
        url:islandora_canvas_params.islandora_delete_annotation + urn,
        data: urn,
        success: function(data,status,xhr) {
            $(selector).next().remove();
            $(selector).remove();
            $(classSelector).remove();

        },
        error: function(data,status,xhr) {
        }
    });
}


function islandora_updateAnno(urn, title,annoType, content, color){
    $.ajax({
        type:'POST',
        url:islandora_canvas_params.islandora_update_annotation,
        data: {
            urn:urn,
            title:title,
            annoType:annoType,
            content:content,
            color:color,
            strokeWidth: $('#stroke_width').val()
        },
        success: function(data,status,xhr) {
            $('#create_annotation_box').hide();
            var selector = '#anno_'+urn;
            var text = $(selector).text().trim().substring(2,100);
            old_title = $(selector).html();
            new_title = old_title.replace(text, title);
            islandora_canvas_params.strokeWidth['urn:uuid:'+urn] = $('#stroke_width').val();

            $(selector).html(new_title);
            $(selector).next('.comment_text').find('.comment_type').text(annoType);
            $(selector).next('.comment_text').find('.comment_content').text(content);
            var fixed_cat = annoType.replace(/[^\w]/g,'');

            $annotation = $(selector).closest('.canvas_annotation');
            $destination = $('#islandora_annoType_content_' + fixed_cat);
            $annotation.appendTo($destination);
       
            $('#create_annotation').empty().append('Annotate');
            $('#create_annotation').css({
                color:'#000000'
            });
            $('#canvases .canvas').each(function() {
                cnv = $(this).attr('canvas');
                destroyAll(cnv);
            });
            //reset all the annos in the columns so things are consistent.
           	
            $('#create_annotation_box').hide();   
            
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
               
        },
        error: function(data,status,xhr) {
            alert('Failed to update annotation')
        }
    });
  
}