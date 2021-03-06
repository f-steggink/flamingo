/* 
 * Copyright (C) 2012-2013 B3Partners B.V.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
/**
 * Maptip component
 * Creates a maptip component
 * @author <a href="mailto:roybraam@b3partners.nl">Roy Braam</a>
 */
Ext.define ("viewer.components.Maptip",{
    extend: "viewer.components.Component",    
    balloon: null,
    maptipComponent: null,
    config: {
        layers: null,
        maptipdelay: null,
        height: null,
        width: null,
        maxDescLength: 30,
        moreLink: null,
        detailShowAttr: true,
        detailShowTitle: true,
        detailShowDesc: true,
        detailShowImage: true,
        heightDescription: null
    },
    serverRequestEnabled: false,
    serverRequestLayers: null,
    featureInfo: null,
    enabled: true,
    lastPosition: null,
    worldPosition: null,
    requestExtent:null,
    requestManager:null,
    /**
     * @constructor
     */
    constructor: function (conf){     
        conf.isPopup=true;
        viewer.components.Maptip.superclass.constructor.call(this, conf);
        this.initConfig(conf);
        
        //make the balloon
        this.balloon = new Balloon(this.getDiv(),this.getViewerController().mapComponent,"balloon",this.width,this.height);
        this.balloon.zIndex = this.balloon.zIndex+1;
        //set the offset of the map        
        var me = this;        
        //if topmenu height is in % then recalc on every resize.        
        var topMenuLayout=this.viewerController.getLayout('top_menu');
        if (topMenuLayout.heightmeasure && topMenuLayout.heightmeasure =="%"){
            Ext.EventManager.onWindowResize(function(){
                me.onResize();            
            }, this);
        }        
        this.onResize();
        
        //listen to the on addlayer
        this.getViewerController().mapComponent.getMap().addListener(viewer.viewercontroller.controller.Event.ON_LAYER_ADDED,this.onAddLayer,this);
        this.getViewerController().mapComponent.getMap().addListener(viewer.viewercontroller.controller.Event.ON_LAYER_REMOVED,this.onLayerRemoved,this);
        //listen to the onmaptipcancel
        this.getViewerController().mapComponent.getMap().addListener(viewer.viewercontroller.controller.Event.ON_MAPTIP_CANCEL,this.onMaptipCancel,this);             
        this.getViewerController().mapComponent.getMap().addListener(viewer.viewercontroller.controller.Event.ON_CHANGE_EXTENT,function(map,options){
            this.balloon.close();
        },this);             
                
        //Add the maptip component to the framework
        conf.type = viewer.viewercontroller.controller.Component.MAPTIP;
        this.maptipComponent = this.getViewerController().mapComponent.createComponent(conf);
        this.getViewerController().mapComponent.addComponent(this.maptipComponent);        
        return this;
    },    
    /**
     * Event handler for when a layer is added to the map
     * @see event ON_LAYER_ADDED
     */
    onAddLayer: function(map,options){     
        var mapLayer = options.layer;
        if (mapLayer==null)
            return;
        if (!this.isLayerConfigured(mapLayer)){
            return;
        }
        if(this.isSummaryLayer(mapLayer)){            
            if (mapLayer.appLayerId){
                var appLayer=this.viewerController.app.appLayers[mapLayer.appLayerId];
                var layer = this.viewerController.app.services[appLayer.serviceId].layers[appLayer.layerName];
                //Store the current map extent for every maptip request.            
                this.viewerController.mapComponent.getMap().addListener(viewer.viewercontroller.controller.Event.ON_MAPTIP,function(map,options){
                    this.setRequestExtent(map.getExtent());
                },this);         

                //do server side getFeature.
                if (layer.hasFeatureType){
                    this.addLayerInServerRequest(appLayer);
                }else{
                    if(mapLayer.getLayers() != null){
                        //let the mapComponent handle the getFeature
                        mapLayer.setMaptips(mapLayer.getLayers().split(","));
                        //listen to the onMaptipData
                        mapLayer.addListener(viewer.viewercontroller.controller.Event.ON_MAPTIP_DATA,this.onMapData,this);
                    }
                }
            }else{
                mapLayer.addListener(viewer.viewercontroller.controller.Event.ON_MAPTIP_DATA,this.onMapData,this);         
            }
        }
    },
    
    onLayerRemoved: function(map,options) {
        var mapLayer = options.layer;
        if (mapLayer==null)
            return;        
        if(this.isSummaryLayer(mapLayer)){            
            if (mapLayer.appLayerId){
                var appLayer=this.viewerController.app.appLayers[mapLayer.appLayerId];
                var layer = this.viewerController.app.services[appLayer.serviceId].layers[appLayer.layerName];
                if (layer.hasFeatureType && this.serverRequestLayers){
                    Ext.Array.remove(this.serverRequestLayers, appLayer);
                }
            }
        }

    },
    
    onResize : function(){
        var top = this.viewerController.getTopMenuHeightInPixels();        
        this.balloon.offsetY=Number(top);
    },
    
    /**
     * Enable doing server requests.
     * @param appLayer the applayer
     */
    addLayerInServerRequest: function (appLayer){ 
        //first time register for event and make featureinfo ajax request handler.
        if (!this.serverRequestEnabled){
            this.viewerController.mapComponent.getMap().addListener(viewer.viewercontroller.controller.Event.ON_MAPTIP,this.doServerRequest,this);
            this.requestManager = Ext.create(viewer.components.RequestManager,Ext.create("viewer.FeatureInfo", {viewerController: this.viewerController}), this.viewerController);
            
            this.serverRequestEnabled = true;
        }
        if (this.serverRequestLayers ==null){
            this.serverRequestLayers=new Array();
        }
        Ext.Array.include(this.serverRequestLayers, appLayer);
    },
    /**
     * Do a server request
     */
    doServerRequest: function(map,options){
        if (!this.requestManager || !this.enabled){
            return;
        }        
        var radius=4*map.getResolution();
        var me=this;
        
        var currentScale = this.viewerController.mapComponent.getMap().getScale();
        
        var inScaleLayers = new Array();
        if (this.serverRequestLayers){
            for (var i=0; i < this.serverRequestLayers.length; i++){
                if (this.viewerController.isWithinScale(this.serverRequestLayers[i],currentScale)){
                    inScaleLayers.push(this.serverRequestLayers[i]);
                }
            }
        }
        var requestId = Ext.id();

        this.requestManager.request(requestId, options, radius, inScaleLayers,  function(data) {
            options.data = data;
            var curExtent = me.viewerController.mapComponent.getMap().getExtent();
            if (curExtent.equals(me.requestExtent)){
                for( var i = 0 ; i < data.length ;i++){
                    var data = data[i];
                    var layer = me.viewerController.getLayer(data.appLayer);
                    layer.fireEvent(viewer.viewercontroller.controller.Event.ON_GET_FEATURE_INFO_DATA, data.appLayer,data);
                }
            }
            
            me.onMapData(null, options);
        }, this.onFailure);
    },
    /**
     * Handles when the mapping framework returns with data
     * @param layer the layer
     * @param options the options of the event
     */
    onMapData: function(layer,options){
        var curExtent = this.viewerController.mapComponent.getMap().getExtent();
        if (curExtent.equals(this.requestExtent)){
            this.onDataReturned(options);
        }
    },
    /**
     * Handle the data that is returned.
     * @param options options that is given by the event
     */
    onDataReturned: function(options){
        try{
            var browserZoomRatio = this.getBrowserZoomRatio();

            if (browserZoomRatio!=1){            
                options.y= Math.round(browserZoomRatio * (options.y));        
                options.x= Math.round(browserZoomRatio * options.x);
            }

            //if not enabled: stop
            if (!this.enabled){
                return;
            }
            //if the mouse is in the balloon, stop. Dont show new data.
            if (this.balloon.isMouseOver()){
                return;
            }
            //if position is not the last position remove content
            if (this.lastPosition){
                if (this.lastPosition.x != options.x ||
                    this.lastPosition.y != options.y){
                    this.balloon.setContent("");
                }
            }else{
                this.lastPosition = new Object();
            }
            this.lastPosition.x = options.x;
            this.lastPosition.y = options.y;
            this.worldPosition = options.coord;
            //alert(layer);
            var me = this;
            var data=options.data;        
            var components=[];    
            //this.balloon.getContentElement().insertHtml("beforeEnd", "BOEEEEE");
            if (data==null || data =="null" || data==undefined){
                return;
            }
            components = this.createInfoHtmlElements(data);
            if (!Ext.isEmpty(components)){
                var x= options.x;
                var y= options.y;               
                this.balloon.setPosition(x,y,true,browserZoomRatio);
                this.balloon.addElements(components);
                this.balloon.show();
            }
        }catch(e){
            this.viewerController.logger.error(e);
        }
    },
    /**
     * create info elements for the balloon.
     */
    createInfoHtmlElements: function (data){
        var me = this;
        var components=[];
        for (var layerIndex in data){            
            var layer=data[layerIndex];
            if (layer.error){
                this.viewerController.logger.error(layer.error);
            }else{
                var appLayer =  this.viewerController.app.appLayers[layer.request.appLayer];
                var details;
                if (appLayer){
                    details = appLayer.details;
                }else{
                    details = this.viewerController.mapComponent.getMap().getLayer(layer.request.appLayer).getDetails();
                }

                var noHtmlEncode = "true" == details['summary.noHtmlEncode'];
                var nl2br = "true" == details['summary.nl2br'];
                //has a details for this layer
                if (details[layer.request.serviceLayer]){
                    details=details[layer.request.serviceLayer];
                }
                var showRightColumn = (details && details["summary.image"]);
                var layerName= layer.request.appLayer;
                for (var index in layer.features){
                    var feature = layer.features[index];
                    //backwards compatibility. If the feature is the attributes (old way) use the feature as attribute obj.
                    var attributes = feature.attributes? feature.attributes : feature;
                    var featureDiv = new Ext.Element(document.createElement("div"));
                    featureDiv.addCls("feature_summary_feature");
                    var id= "f";
                    if (appLayer){
                        id += appLayer.serviceId;
                    }
                    id += "_"+layerName+"_"+index;                        
                    featureDiv.id= id;
                    //left column
                    var leftColumnDiv = new Ext.Element(document.createElement("div"));
                    leftColumnDiv.addCls("feature_summary_leftcolumn");
                    if(!showRightColumn) {
                        leftColumnDiv.setStyle({
                            'width': '100%'
                        });
                    }
                        //title
                        if (details && details["summary.title"] ){
                            var titleDiv = new Ext.Element(document.createElement("div"));
                            titleDiv.addCls("feature_summary_title");
                            titleDiv.insertHtml("beforeEnd",this.replaceByAttributes(details["summary.title"],attributes,noHtmlEncode,nl2br));
                            leftColumnDiv.appendChild(titleDiv);
                        }
                        //description
                        if (details && details["summary.description"]){
                            var descriptionDiv = new Ext.Element(document.createElement("div"));
                            descriptionDiv.addCls("feature_summary_description");
                            if (this.heightDescription){
                                descriptionDiv.setHeight(Number(this.heightDescription));
                            }
                            var desc = this.replaceByAttributes(details["summary.description"],attributes,noHtmlEncode,nl2br);

                            descriptionDiv.insertHtml("beforeEnd",desc);
                            leftColumnDiv.appendChild(descriptionDiv);
                        }
                        //link
                        if (details && details["summary.link"]){
                            var linkDiv = new Ext.Element(document.createElement("div"));
                            linkDiv.addCls("feature_summary_link");
                            linkDiv.insertHtml("beforeEnd","<a target='_blank' href='"+this.replaceByAttributes(details["summary.link"],attributes,noHtmlEncode,nl2br)+"'>link</a>");
                            leftColumnDiv.appendChild(linkDiv);
                        }
                        //detail
                        var detailDiv = new Ext.Element(document.createElement("div"));
                        detailDiv.addCls("feature_summary_detail");
                        //detailDiv.insertHtml("beforeEnd","<a href='javascript: alert(\"boe\")'>Detail</a>");
                        if (this.getMoreLink()!=null){ 
                            var detailElem=document.createElement("a");
                            detailElem.href='javascript: void(0)';
                            detailElem.feature=attributes;
                            detailElem.appLayer=appLayer;
                            var detailLink = new Ext.Element(detailElem);
                            detailLink.addListener("click",
                                function (evt,el,o){ 
                                    me.showDetails(el.appLayer,el.feature);
                                },
                                this);
                            detailLink.insertHtml("beforeEnd",this.getMoreLink());
                            detailDiv.appendChild(detailLink);
                        }                            
                        leftColumnDiv.appendChild(detailDiv);

                    featureDiv.appendChild(leftColumnDiv);

                    if (showRightColumn) {
                        var rightColumnDiv = new Ext.Element(document.createElement("div"));
                        rightColumnDiv.addCls("feature_summary_rightcolumn");
                        var imageDiv = new Ext.Element(document.createElement("div"));
                        imageDiv.addCls("feature_summary_image");
                        imageDiv.insertHtml("beforeEnd","<img src='"+this.replaceByAttributes(details["summary.image"],attributes,noHtmlEncode,nl2br)+"'/>");
                        rightColumnDiv.appendChild(imageDiv);
                        featureDiv.appendChild(rightColumnDiv);
                    }

                    components.push(featureDiv);

                }
            }
        }
        return components;
    },
    /**
     * Return the browser zoom ratio.
     * @return ratio of zoom (in or out)
     */
    getBrowserZoomRatio: function(){
        return Ext.get(this.viewerController.layoutManager.mapId).getWidth() / this.viewerController.mapComponent.getWidth();
    },
    /**
     * Handles the show details click.
     * @param appLayer the applayer for the details
     * @param feature the feature that must be shown
     */
    showDetails: function(appLayer,feature){
        var cDiv=Ext.get(this.getContentDiv());
        cDiv.update("");
        /*
        cDiv.update(html);   */
        var featureDiv = new Ext.Element(document.createElement("div"));
        featureDiv.addCls("feature_detail_feature");
        featureDiv.setStyle("background-color", "white");
        featureDiv.id="f_details_"+appLayer.serviceId+"_"+appLayer.layerName;
        
        var noHtmlEncode = "true" == appLayer.details['summary.noHtmlEncode'];
        var nl2br = "true" == appLayer.details['summary.nl2br'];
        
        if (appLayer.details){
            //title
            if (this.detailShowTitle && appLayer.details["summary.title"] ){
                var titleDiv = new Ext.Element(document.createElement("div"));
                titleDiv.addCls("feature_detail_title");
                titleDiv.insertHtml("beforeEnd",this.replaceByAttributes(appLayer.details["summary.title"],feature,noHtmlEncode,nl2br));
                featureDiv.appendChild(titleDiv);
            }
            //description
            if (this.detailShowDesc && appLayer.details["summary.description"]){
                var descriptionDiv = new Ext.Element(document.createElement("div"));
                descriptionDiv.addCls("feature_detail_description");
                descriptionDiv.insertHtml("beforeEnd",this.replaceByAttributes(appLayer.details["summary.description"],feature,noHtmlEncode,nl2br));
                featureDiv.appendChild(descriptionDiv);
            }
            //image
            if (this.detailShowImage && appLayer.details["summary.image"]){
                var imageDiv = new Ext.Element(document.createElement("div"));
                imageDiv.addCls("feature_detail_image");
                var img = "<img src='"+this.replaceByAttributes(appLayer.details["summary.image"],feature,noHtmlEncode,nl2br)+"' ";
                if (this.popup.config.details && this.popup.config.details.width){
                    img+="style='max-width: "+(this.popup.config.details.width-40)+"px;'";
                }
                img+="/>";
                imageDiv.insertHtml("beforeEnd",img);
                featureDiv.appendChild(imageDiv);
            }
            //link
            if (appLayer.details["summary.link"]){
                var linkDiv = new Ext.Element(document.createElement("div"));
                linkDiv.addCls("feature_detail_link");
                linkDiv.insertHtml("beforeEnd","<a target='_blank' href='"+this.replaceByAttributes(appLayer.details["summary.link"],feature,noHtmlEncode,nl2br)+"'>link</a>");
                featureDiv.appendChild(linkDiv);
            }
            //description attribute
            if (appLayer.details["summary.description_attributes"]){
                var descriptionDiv = new Ext.Element(document.createElement("div"));
                descriptionDiv.addCls("feature_detail_description_attr");
                descriptionDiv.insertHtml("beforeEnd",this.replaceByAttributes(appLayer.details["summary.description_attributes"],feature,noHtmlEncode,nl2br));
                featureDiv.appendChild(descriptionDiv);
            }
        }
        if (this.detailShowAttr){
            //attributes:
            if (!Ext.isEmpty(feature)){
                var html="<table>";
                for( var key in feature){
                    html+="<tr>"
                    html+="<td class='feature_detail_attr_key'>"+key+"</td>";
                    var value = String(feature[key]);
                    if(!noHtmlEncode) {
                        value = Ext.String.htmlEncode(value);
                    }
                    if(nl2br) {
                        value = Ext.util.Format.nl2br(value);
                    }
                    html+="<td class='feature_detail_attr_value'>"+value+"</td>";
                    html+="</tr>"
                }
                html+="</table>";
                var attributesDiv = new Ext.Element(document.createElement("div"));
                attributesDiv.addCls("feature_detail_attr");
                attributesDiv.insertHtml("beforeEnd",html);
                featureDiv.appendChild(attributesDiv);
            }
        }
        cDiv.appendChild(featureDiv);        
        this.popup.show();
    },
    onFailure: function(e){
        this.viewerController.logger.error(e);
        //Ext.MessageBox.alert("Error",e);
    },
    /**
     * Event handler for the ON_MAPTIP_CANCEL event
     * @see event ON_MAPTIP_CANCEL
     */
    onMaptipCancel: function (map){
        this.balloon.hideAfterMouseOut();
    },
    /**
     * Replaces all [feature names] with the values of the feature.
     * @param text the text that must be search for 'feature names'
     * @param feature a object with object[key]=value 
     * @param noHtmlEncode allow HTML tags in feature values
     * @param nl2br Replace newlines in feature values with br tags
     * @return a new text with all [key]'s  replaced
     */
    replaceByAttributes: function(text,feature,noHtmlEncode,nl2br){
        if (Ext.isEmpty(text))
            return "";
        var newText=""+text;
        for (var key in feature){
            var regex = new RegExp("\\["+key+"\\]","g");
            var value = String(feature[key]);
            if(!noHtmlEncode) {
                value = Ext.String.htmlEncode(value);
            }
            if(nl2br) {
                value = Ext.util.Format.nl2br(value);
            }            
            newText=newText.replace(regex,value);
        }
        //remove all remaining [...]
        var begin=newText.indexOf("[");
        var end=newText.indexOf("]");
        while(begin >=0 && end>0){            
            newText=newText.replace(newText.substring(begin,end+1),"");
            begin=newText.indexOf("[");
            end=newText.indexOf("]");
        }
        return newText;
    },
    /**
     * Gets the layers that have a maptip configured
     * @param layer a mapComponent layer.
     * @return a string of layer names in the given layer that have a maptip configured.
     */
    isSummaryLayer: function(layer){
        var details = layer.getDetails();        
        return this.isSummaryDetails(details);
    },
    /**
     * Check if the given details has data to show configured
     * @param details the details for a layer
     */
    isSummaryDetails: function (details){
        if (details !=undefined &&
            (!Ext.isEmpty(details["summary.description"]) ||
                !Ext.isEmpty(details["summary.image"]) ||
                !Ext.isEmpty(details["summary.link"]) ||
                !Ext.isEmpty(details["summary.title"]))){
            return true;
        }
        return false;
    },
    /**
     * Checks if a layer is enabled for this component.
     * If no layers are configured then true is returned
     * Otherwise the appLayerId is checked of the given mapLayer in the list 
     * of configured layers.
     */
    isLayerConfigured: function (mapLayer){
        //if there are layers configured, check if the added layer is in the configured list.
        if (this.layers && this.layers.length >0){
            for (var i in this.layers){
                if (this.layers[i] == mapLayer.appLayerId){
                    return true;
                }
            }
            return false;
        }
        return true;
    },
    /**
     * Over write the getMoreLink function so it always returns a String even when empty
     * @return the configured 'moreLink' or the default when not configured.
     */
    getMoreLink: function(){
        if (Ext.isEmpty(this.moreLink)){
            return null;
        }
        return this.moreLink;
    },
    /**
     *Get the application layer
     *@param layername the name of the layer
     *@param serviceId the id of the service
     *@return the application layer JSON object.
     */
    getApplicationLayer: function (layerName,serviceId){
        var appLayers=this.viewerController.app.appLayers;
        for (var id in appLayers){
            if (appLayers[id].serviceId==serviceId &&
                appLayers[id].layerName==layerName){
                return appLayers[id];
            }
        }
        return null;
    },
    
    /**
     */
    setRequestExtent: function (requestExtent){
        this.requestExtent=requestExtent;
    },
    /**
     * set visibility
     * @param vis true or false
     */
    setVisible: function(vis){
        if(this.balloon==null){
            return;
        }
        if(!vis){
            this.balloon.hide();
        }else{
            this.balloon.show();
        }
    },
    /**
     * set enabled
     * @param true/false
     */
    setEnabled: function(ena){
        this.enabled=ena;
        if (!this.enabled){
            this.setVisible(false);
        }
    },
    getExtComponents: function() {
        return [];
    }
    
});

/** Creates a balloon.
 *TODO: Place in own file so it can be used by other components and make it a ext class
 * @param mapDiv The div element where the map is in.
 * @param viewerController the viewerController that controlles the map
 * @param balloonId the id of the DOM element that represents the balloon.
 * @param balloonWidth the width of the balloon (optional, default: 300);
 * @param balloonHeight the height of the balloon (optional, default: 300);
 * @param offsetX the offset x
 * @param offsetY the offset y
 * @param balloonCornerSize the size of the rounded balloon corners of the round.png image(optional, default: 20);
 * @param balloonArrowHeight the hight of the arrowImage (optional, default: 40);
 */
function Balloon(mapDiv,viewerController,balloonId, balloonWidth, balloonHeight, offsetX,offsetY, balloonCornerSize, balloonArrowHeight){
    this.mapDiv=Ext.get(mapDiv);    
    this.viewerController=viewerController;
    this.balloonId=balloonId;
    this.balloonWidth=300;
    this.balloonHeight=300;
    this.balloonCornerSize=20;
    this.balloonArrowHeight=20;
    this.balloonContent=null;    
    this.mouseIsOverElement=new Object();
    this.maptipId=0;
    this.closeOnMouseOut=true;
    this.showCloseButton=false;
    this.zIndex=13000;
    //because click events still needs to be handled by the map, move the balloon a bit
    this.offsetX=1;
    this.offsetY=0;
    this.roundImgPath=contextPath+"/viewer-html/components/resources/images/maptip/round.png";
    this.arrowImgPath=contextPath+"/viewer-html/components/resources/images/maptip/arrow.png";
    //this.leftOfPoint;
    //this.topOfPoint;
    
    //the balloon jquery dom element.
    this.balloon=null;
    this.x=null;
    this.y=null;

    if (balloonWidth){
        this.balloonWidth=balloonWidth;
    }
    if (balloonHeight)
        this.balloonHeight=balloonHeight;
    if (balloonCornerSize){
        this.balloonCornerSize=balloonCornerSize;
    }
    if (balloonArrowHeight){
        this.balloonArrowHeight=balloonArrowHeight;
    }
    if (offsetX){
        this.offsetX=offsetX;
    }
    if (offsetY){
        this.offsetY=offsetY;
    }
    /**
     *Private function. Don't use.
     */
    this._createBalloon = function(x,y){
        //create balloon and styling.
        this.balloon=new Ext.Element(document.createElement("div"));
        this.balloon.addCls("infoBalloon");
        this.balloon.id = this.balloonId;
                
        this.balloon.applyStyles({            
            'position': 'absolute',
            'width':""+this.balloonWidth+"px",
            'height':""+this.balloonHeight+"px",
            'z-index':this.zIndex
        });

        var maxCornerSize=this.balloonHeight-(this.balloonArrowHeight*2)+2-this.balloonCornerSize;
        
        var topLeftEl=document.createElement("div");
        topLeftEl.innerHTML="<img style='position: absolute;' src='"+this.roundImgPath+"'/>";
        var topLeft = new Ext.Element(topLeftEl);
        topLeft.addCls("balloonCornerTopLeft");
        topLeft.applyStyles({
            'width': this.balloonCornerSize+'px',
            'height':this.balloonCornerSize+'px',
            'left':  '0px',
            'top':  this.balloonArrowHeight-1+'px',
            'width':  this.balloonWidth-this.balloonCornerSize+'px',
            'height': maxCornerSize+'px'
        });
        topLeft.on("mouseover",function(){
            this.onMouseOver('topLeft');
        },this); 
        topLeft.on("mouseout",function(){
            this.onMouseOut('topLeft');
        },this);  
        this.balloon.appendChild(topLeft);
        
        var topRightEl = document.createElement("div");
        topRightEl.innerHTML="<img style='position: absolute; left: -1004px;' src='"+this.roundImgPath+"'/>";
        var topRight= new Ext.Element(topRightEl);
        topRight.addCls("balloonCornerTopRight");
        topRight.applyStyles({
            'width':this.balloonCornerSize+'px',
            'height':maxCornerSize+'px',
            'top': this.balloonArrowHeight-1+'px',
            'right':'0px'
        });
        topRight.on("mouseover",function(){
            this.onMouseOver('topRight');
        },this); 
        topRight.on("mouseout",function(){
            this.onMouseOut('topRight');
        },this); 
        this.balloon.appendChild(topRight);
        
        var bottomLeftEl = document.createElement("div");
        bottomLeftEl.innerHTML="<img style='position: absolute; top: -748px;' src='"+this.roundImgPath+"'/>";
        var bottomLeft=new Ext.Element(bottomLeftEl);
        bottomLeft.addCls("balloonCornerBottomLeft");
        bottomLeft.applyStyles({        
            'height':this.balloonCornerSize+'px',
            'left':  '0px',
            'bottom': this.balloonArrowHeight-1+'px',
            'width': this.balloonWidth-this.balloonCornerSize+'px'
        });
        bottomLeft.on("mouseover",function(){
            this.onMouseOver('bottomLeft');
        },this); 
        bottomLeft.on("mouseout",function(){
            this.onMouseOut('bottomLeft');
        },this); 
        this.balloon.appendChild(bottomLeft);
        
        var bottomRightEl = document.createElement("div");
        bottomRightEl.innerHTML="<img style='position: absolute; top: -748px; left: -1004px;' src='"+this.roundImgPath+"'/>";
        var bottomRight = new Ext.Element(bottomRightEl);
        bottomRight.addCls("balloonCornerBottomRight");
        bottomRight.applyStyles({
            'width':this.balloonCornerSize+'px',
            'height':this.balloonCornerSize+'px',
            'right':'0px',
            'bottom':this.balloonArrowHeight-1+'px'
        });
        bottomRight.on("mouseover",function(){
            this.onMouseOver('bottomRight');
        },this); 
        bottomRight.on("mouseout",function(){
            this.onMouseOut('bottomRight');
        },this); 
        this.balloon.appendChild(bottomRight);
        
        //arrows
        this.balloon.insertHtml("beforeEnd","<div class='balloonArrow balloonArrowTopLeft' style='display: none; width:"+this.balloonArrowHeight+"px; height:"+this.balloonArrowHeight+"px;'><img src='"+this.arrowImgPath+"'/></div>");
        this.balloon.insertHtml("beforeEnd","<div class='balloonArrow balloonArrowTopRight' style='display: none; width:"+this.balloonArrowHeight+"px; height:"+this.balloonArrowHeight+"px;'><img style='left: -"+this.balloonArrowHeight+"px;' src='"+this.arrowImgPath+"'/></div>");
        this.balloon.insertHtml("beforeEnd","<div class='balloonArrow balloonArrowBottomLeft' style='display: none; width:"+this.balloonArrowHeight+"px; height:"+this.balloonArrowHeight+"px;'><img style='left: -"+(2*this.balloonArrowHeight)+"px;' src='"+this.arrowImgPath+"'/></div>");
        this.balloon.insertHtml("beforeEnd","<div class='balloonArrow balloonArrowBottomRight' style='display: none; width:"+this.balloonArrowHeight+"px; height:"+this.balloonArrowHeight+"px;'><img style='left: -"+(3*this.balloonArrowHeight)+"px;' src='"+this.arrowImgPath+"'/></div>");
        
        //content        
        var balloonContentEl = document.createElement("div");
        //balloonContentEl.innerHTML=
        this.balloonContent= new Ext.Element(balloonContentEl);
        this.balloonContent.addCls('balloonContent');
        this.balloonContent.applyStyles({
            top: this.balloonArrowHeight+5+"px",
            bottom: this.balloonArrowHeight+4+"px"
        });
        this.balloonContent.on("mouseover",function(){
            this.onMouseOver('balloonContent');
        },this); 
        this.balloonContent.on("mouseout",function(){
            this.onMouseOut('balloonContent');
        },this); 
        this.balloon.appendChild(this.balloonContent);
        //closing button
        if(this.showCloseButton){
            var thisObj = this;
            var closeButton = new Ext.Element(document.createElement("div"));
            closeButton.addCls("balloonCloseButton");
            closeButton.applyStyles({
                right: '7px',
                top: this.balloonArrowHeight+3+"px"
            });
            closeButton.addListener("click",function(){
                thisObj.close();
            });
            this.balloon.appendChild(closeButton);
        }
        /*var thisObj=this;
        this.balloon.append($j("<div class='balloonCloseButton'></div>")
            .css('right','7px')
            .css('top',''+(this.balloonArrowHeight+3)+'px')
            .click(function(){
                thisObj.remove();
                return false;
            })

        );*/
        
        this.x=x;
        this.y=y;

        //calculate position
        this._resetPositionOfBalloon(x,y);
        
        //append the balloon.
        Ext.get(this.mapDiv).appendChild(this.balloon);

    }      
    /**
     *Private function. Use setPosition(x,y,true) to reset the position
     *Reset the position to the point. And displays the right Arrow to the point
     *Sets the this.leftOfPoint and this.topOfPoint
     *@param x the x coord
     *@param y the y coord
     */
    this._resetPositionOfBalloon = function(x,y){
        //calculate position
        var centerCoord= this.viewerController.getMap().getCenter();
        //var centerPixel= this.viewerController.getMap().coordinateToPixel(centerCoord.x,centerCoord.y);
        //var infoPixel= this.viewerController.getMap().coordinateToPixel(x,y);        
        var centerX = this.mapDiv.getWidth()/2; 
        var centerY = this.mapDiv.getHeight()/2;
        //determine the left and top.
        if (x > centerX){
            this.leftOfPoint=true;
        }else{
            this.leftOfPoint=false;
        }
        if (y > centerY){
            this.topOfPoint=true;
        }else{
            this.topOfPoint=false;
        }
        //display the right arrow
        this.balloon.select(".balloonArrow").applyStyles({'display':'none'});
        //$j("#infoBalloon > .balloonArrow").css('display', 'block');
        if (!this.leftOfPoint && !this.topOfPoint){
            //popup is bottom right of the point
            this.balloon.select(".balloonArrowTopLeft").applyStyles({"display":"block"});
        }else if (this.leftOfPoint && !this.topOfPoint){
            //popup is bottom left of the point
            this.balloon.select(".balloonArrowTopRight").applyStyles({"display":"block"});
        }else if (this.leftOfPoint && this.topOfPoint){
            //popup is top left of the point
            this.balloon.select(".balloonArrowBottomRight").applyStyles({"display":"block"});
        }else{
            //pop up is top right of the point
            this.balloon.select(".balloonArrowBottomLeft").applyStyles({"display":"block"});
        }
    }
    /**
     *called by internal elements if the mouse is moved in 1 of the maptip element
     *@param the id of the element.
     */
    this.onMouseOver= function(elementId){
        this.mouseIsOverElement[elementId]=1;
    }
    /**
     *called by internal elements when the mouse is out 1 of the maptip element
     *@param the id of the element.
     */
    this.onMouseOut= function(elementId){
        this.mouseIsOverElement[elementId]=0;   
        if (this.closeOnMouseOut){
            var thisObj=this;
            setTimeout(function(){
                if (!thisObj.isMouseOver()){
                    thisObj.hide();
                }
            },50);
        }
        
    }
    this.isMouseOver = function(){
        for (var elementid in this.mouseIsOverElement){
            if(this.mouseIsOverElement[elementid]==1){
                return true;
            }
        }
        return false;
    }

    /**
     *Set the position of this balloon. Create it if not exists
     *@param x pixel x
     *@param y pixel y
     *@param resetPositionOfBalloon boolean if true the balloon arrow will be
     *@param browserZoomRatio if the browser is zoomed.
     *redrawn (this.resetPositionOfBalloon is called)
     */
    this.setPosition = function (x,y,resetPositionOfBalloon,browserZoomRatio){       
        //new maptip position so update the maptipId
        this.maptipId++;
        
        if (this.balloon==undefined){
            this._createBalloon(x,y);
        }else if(resetPositionOfBalloon){
            this._resetPositionOfBalloon(x,y);
        }
        if (x!=undefined && y != undefined){
            
            this.x=x;
            this.y=y;
            if (browserZoomRatio!=undefined && browserZoomRatio!=null && browserZoomRatio!=1){
                this.x = this.x*browserZoomRatio;
                this.y = this.y*browserZoomRatio;                
            }
        }else if (this.x ==undefined || this.y == undefined){
            throw "No coords found for this balloon";
        }else{
            x=this.x;
            y=this.y;
        }
        this.balloon.applyStyles({'display':'block'});
       

        //calculate position
        //var infoPixel= this.viewerController.getMap().coordinateToPixel(x,y);

        //determine the left and top.
        var correctedOffsetX=this.offsetX;
        var correctedOffsetY=this.offsetY;
        //if (browserZoomRatio!=undefined && browserZoomRatio!=null && browserZoomRatio!=1){
            //correctedOffsetX=Math.round(correctedOffsetX*browserZoomRatio);
            //correctedOffsetY=Math.round(correctedOffsetY*browserZoomRatio);
        //}
        var left=x+correctedOffsetX;
        var top =y+correctedOffsetY;
        if (this.leftOfPoint){
            left=left-this.balloonWidth;
        }
        if (this.topOfPoint){
            top= top-this.balloonHeight;
        }
       //set position of balloon
        this.balloon.setLeft(""+left+"px");
        this.balloon.setTop(""+top+"px");
    }
    /**
     *Set the position of this balloon. Create it if not exists
     *@param xcoord The world x coord
     *@param ycoord the world y coord
     *@param resetPositionOfBalloon boolean if true the balloon arrow will be
     *redrawn (this.resetPositionOfBalloon is called)
     *@param browserZoomRatio the ratio the browser is zoomed (in or out)
     */
    this.setPositionWorldCoords = function (xcoord,ycoord,resetPositionOfBalloon, browserZoomRatio){
        var pixel= this.viewerController.getMap().coordinateToPixel(xcoord,ycoord);   
        this.setPosition(pixel.x, pixel.y, resetPositionOfBalloon,browserZoomRatio);
    }
    /**
     * xxx not working! Make it work!
     * Remove the balloon
     **/
    this.remove = function(){
        this.balloon.remove();
        this.viewerController.getMap().removeListener(viewer.viewercontroller.controller.Event.ON_FINISHED_CHANGE_EXTENT,viewerController.getMap(), this.setPosition,this);
        delete this.balloon;
    }
    /*Get the DOM element where the content can be placed.*/
    this.getContentElement = function(){     
        if (this.balloon==undefined || this.balloonContent ==undefined)
            return null;
        return this.balloonContent;
    }
    this.setContent = function (value){
        var element=this.getContentElement();
        if (element==null)
            return;
        element.update(value);
    }
    this.addContent = function (value){
        var element=this.getContentElement();
        if (element==null)
            return;
        element.insertHtml("beforeEnd", value);
    }
    this.addElements = function (elements){
        var element=this.getContentElement();
        if (element==null)
            return;
        for (var i=0; i < elements.length; i++){
            element.appendChild(elements[i]);
        }
    }
    this.hide = function(){
        if (this.balloon!=undefined)
            this.balloon.setVisible(false);
    }
    this.show = function(){
        if (this.balloon!=undefined)
            this.balloon.setVisible(true);
    }
    this.close = function(){
        this.setContent("");
        this.hide();
    }
    this.hideAfterMouseOut= function(){
        var thisObj = this;
        //store the number to check later if it's still the same maptip position
        var newId= new Number(this.maptipId);
        setTimeout(function(){
            if (newId==thisObj.maptipId){
                if (!thisObj.isMouseOver()){
                    thisObj.setContent("");
                    thisObj.hide();
                }
            }else{
            }
        },1000);
    }  
}

