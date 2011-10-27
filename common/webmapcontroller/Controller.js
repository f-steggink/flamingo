/*JavaScript interface class file*/

/**
 * Controller
 * @class 
 * @constructor
 * @param viewerObject Het viewerObject
 */
function Controller(viewerObject){
    this.maps= new Array();
    this.tools= new Array();
    this.events = new Array();
    this.panel=null;
    this.eventList = new Array();
    webMapController = this;
}
var webMapController = null;
Controller.prototype.getId = function(){
    return "Controller";
}

/******************************Static declarations***************************************/

//Events:
//Controller events:                        0 - 10
Event.ON_CONFIG_COMPLETE                    = 0;
Event.ON_SET_TOOL                           = 1;
    
// Map events:                              11 - 50
Event.ON_GET_FEATURE_INFO                   = 11;
Event.ON_GET_FEATURE_INFO_DATA              = 12;
Event.ON_ALL_LAYERS_LOADING_COMPLETE        = 13;
Event.ON_CHANGE_EXTENT                      = 14;
Event.ON_FINISHED_CHANGE_EXTENT             = 15;


// Layer events:                            50 - 100
Event.ON_GET_CAPABILITIES                   = 50;
Event.ON_FEATURE_ADDED                      = 51;
Event.ON_REQUEST                            = 52;
Event.ON_LOADING_START                      = 53;
Event.ON_LOADING_END                        = 54;
    
// Tool events:                             100 - 150
Event.ON_EVENT_DOWN                         = 100;
Event.ON_EVENT_UP                           = 101;
Event.ON_CLICK                              = 102;
Event.ON_MEASURE                            = 103;

// Shared evens:                            150 - ...
Event.ON_ONIT                               = 150;  // Shared by
    
	
/**
 *Create functions. SubClass needs to implement these so the user can
*create Framework specific objects.
**/

/**
     *Creates a layer for this framework
     *@param name the showable name of the layer
     *@param url the url to the serviceProvider
     *@param ogcParams the params that are used in the OGC-WMS request
     *@param options extra options for this wms layer
     *Must be implemented by subclass
     */
Controller.prototype.createWMSLayer = function(name, url, ogcParams,options){
    throw("Controller.createWMSLayer() Not implemented! Must be implemented in sub-class");
}
/**
 *Creates a OSGEO TMS layer.
 *@param id the id of the layer
 *@param name the showable name of the layer
 *@param url the url to the tms service
 *@param options extra options for this TMS layer
 */
Controller.prototype.createTMSLayer = function (id,name,url, options){
    throw("Controller.createTMSLayer() Not implemented! Must be implemented in sub-class");
}
/**
     *Creates a Map object for this framework
     *@param id the id of the map
     *@param options extra options for the map
     *Must be implemented by subclass
     */
Controller.prototype.createMap = function(id, options){
    throw("Controller.createMap(...) not implemented! Must be implemented in sub-class");
}
/**
     *Must be implemented by the sub-class
     *This creates a tool.
     */
Controller.prototype.createTool= function (){
    throw("Controller.createTool(...) not implemented! Must be implemented in sub-class");
}
/**
     *Add a array of Tool objects. For every tool .addTool is called.
     *@param tools Array of Tool objects
     */
Controller.prototype.addTools = function (tools){
    for (var i=0; i < tools.length; i++){
        addTool(tools[i]);
    }
}

/**
     *Adds the given tool to the list of tools. Sub-class needs to implement this
     *and call super to do some frameworks specific things.
     *@param tool The tool that needs to be added of type Tool
     */
Controller.prototype.addTool = function(tool){
    if (!(tool instanceof Tool)){
        throw("Given tool not of type 'Tool'");
    }
    this.tools.push(tool);
}
/**
     *Removes a tool from the list of tools. Sub-class needs to implement this
     *and call super to do some framework specific things.
     *@param tool The tool that needs to be removed.
     */
Controller.prototype.removeTool = function (tool){
    if (!(tool instanceof Tool)){
        throw("Given tool not of type 'Tool'");
    }
    for (var i=0; i < this.tools; i++){
        if (this.tools[i]==tool){
            this.tools.splice(i,1);
            return;
        }
    }
}

/**
* Helperfunction: Get a tool based on the given id
* @param id The id of the Tool which must be retrieved
 **/
Controller.prototype.getTool = function (id){
    for (var i = 0 ; i < this.tools.length ; i++){
        var tool = this.tools[i];
        if(tool.getId() == id){
            return tool;
        }
    }
    return null;
}
/**
 *Returns the tools that are added with type: type
 *@param type The type of the tools wanted
 *@return A array of tools with the given type (or a empty array when no tool is found)
 */
Controller.prototype.getToolsByType = function(type){
    var foundTools=new Array();
    for(var i=0; i < this.tools.length; i++){
        if(this.tools[i].getType()==type){
            foundTools.push(this.tools[i]);
        }
    }
    return foundTools;
}
/**
     *Removes a tool based on the given id
     *Must be implemented by subclass
	 * @param id Id of the which must be removed
     **/
Controller.prototype.removeToolById = function (id){
    throw("Controller.removeToolById() Not implemented! Must be implemented in sub-class");
}

/**
     *Add a map to the controller
     *Must be implemented by subclass
	 * @param mapObject The map which must be added to the controller.
     **/    
Controller.prototype.addMap = function (mapObject){
    throw("Controller.addMap() Not implemented! Must be implemented in sub-class");
}
/**
     *Gets the map with mapId
     *Must be implemented by subclass
	 * @param mapId The id of the map which must be returned.
     */
Controller.prototype.getMap = function (mapId){
    throw("Controller.getMap() Not implemented! Must be implemented in sub-class");
}
/**
     *Removes the given map from the controller.
     *Must be implemented by subclass
	 * @param removeMap The map which must be removed
     */
Controller.prototype.removeMap = function (removeMap){
    throw("Controller.removeMap() Not implemented! Must be implemented in sub-class");
}

/**
     *Creates a drawable vectorlayer
     *Must be implemented by subclass
	 * A vectorlayer is a layer on which features can be drawn by the user (a EditMap in Flamingo, a VectorLayer in OpenLayers)
	 * @param name The name of this laye
     */
Controller.prototype.createVectorLayer = function (name){
    throw("Controller.createVectorLayer() Not implemented! Must be implemented in sub-class");
}
/**
 *Creates a layer of an image
 *Must be implemented by subclass
 * A vectorlayer is a layer on which features can be drawn by the user (a EditMap in Flamingo, a VectorLayer in OpenLayers)
 * @param name The name of this layer
 * @param url The url of the image
 * @param bounds The boundary of the layer
 * @param size The size of the image
 * @param options Hashtable of extra options to tag onto the layer
 */
Controller.prototype.createImageLayer = function (name,url, bounds, size,options){
    throw("Controller.createImageLayer() Not implemented! Must be implemented in sub-class");
}

/**
* Creates a panel
*/
Controller.prototype.createPanel = function (name){
    throw("Controller.createPanel() Not implemented! Must be implemented in sub-class");
}
/**
 * Registers a function with a given event on the given object
 * Must be implemented by subclass
 * @param event The generic name for the event. Possible values declared as Event.ON_EVENT, etc. See the constructor of this class for the complete list of events.
 * @param object The object on which the event has effect
 * @param handler The function to be called when event takes place. The function must have the following signature:
 * handlerFunction(id,params).
 *
*/
Controller.prototype.registerEvent = function(event, object, handler){
    throw("Controller.registerEvent() Not implemented! Must be implemented in sub-class");
}
/**
 *Unregisters a event.
 *@param event is the event that needs to be unregisterd
 *@param object is the object on which the event must be unregisterd.
 */
Controller.prototype.unRegisterEvent = function (event, object){
    throw("Controller.unRegisterEvent() Not implemented! Must be implemented in sub-class");
}
 
/**
 * Entrypoint for all the fired events.
 * Must be implemented by subclass
 * @param event The event to be handled
 */
Controller.prototype.handleEvents = function(event){
    throw("Controller.handleEvents() Not implemented! Must be implemented in sub-class");
}

/**
* Initialize all the controller specific events.
*/
Controller.prototype.initEvents = function(){
    throw("Controller.initEvent() Not implemented! Must be implemented in sub-class");
}

/**
 * Gets the generic name for the specified specific eventname. Throws exception if specific name does not exist.
 * @param specific The specific name
 * @return The generic name.
 */
Controller.prototype.getGenericEventName = function (specific){
    if (this.eventList.length==0){
        this.initEvents();
    }
    for( var key in this.eventList){
        if(this.eventList[key] == specific){
            return key;
        }
    }
    throw("Event " + specific + " does not exist!");
}

/**
 * Gets the specific name for the specified generic eventname. null or undefined if generic name does not exist.
 * @param generic The generic name
 * @return The specific name.
 */
Controller.prototype.getSpecificEventName = function (generic){
    return this.eventList[generic];
}

/**
 * Activates the tool
 * @param id Id of the tool to be activated
 */
Controller.prototype.activateTool = function (id){
    throw("Controller.activateTool() Not implemented! Must be implemented in sub-class");
}
