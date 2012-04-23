/* 
 * Copyright (C) 2012 B3Partners B.V.
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
 * DataSelection and Filter component
 * Creates a dialog where filter and selection settings can be set.
 * A dataselectionfilter contains 1..n filters, a filter contains 1..n attributefilters.
 * @author <a href="mailto:meinetoonen@b3partners.nl">Meine Toonen</a>
 */
Ext.define ("viewer.components.DataSelection",{
    extend: "viewer.components.Component",
    dataTab : null,
    filterTab : null,
    attributes:null,
    layerSelector:null,
    appLayer: null,
    filters:null,
    filterActive:null,
    config: {
        layers:null,
        title:null,
        iconUrl:null,
        tooltip:null,
        details:{
            width: null,
            height:null
        }
    },
    constructor: function (conf){
        this.attributes =[];
        viewer.components.DataSelection.superclass.constructor.call(this, conf);
        this.filters = new Array();
        this.initConfig(conf); 
        var me = this;
        this.renderButton({
            handler: function(){
                me.showWindow();
            },
            text: me.title,
            icon: me.iconUrl,
            tooltip: me.tooltip
        });
        this.loadWindow();
        return this;
    },
    showWindow : function (){
        this.popup.show();
    },
    showAndForceLayer : function (layer){
        this.layerSelector.addForcedLayer(layer);
        this.layerSelector.initLayers();
        this.showWindow();
    },
    removeForcedLayer : function (layer){
        this.layerSelector.removeForcedLayer(layer);
        this.layerSelector.initLayers();
    },
    loadWindow : function(){
        var config = {
            viewerController : this.viewerController,
            div: this.getContentDiv(),
            layers : this.layers
        };
        this.layerSelector = Ext.create("viewer.components.LayerSelector",config);
        this.layerSelector.addListener(viewer.viewercontroller.controller.Event.ON_LAYERSELECTOR_CHANGE,this.layerChanged,this);
   
        // Make the tabs
        this.tabpanel = Ext.create('Ext.tab.Panel', {
            height: parseInt(this.details.height) - 100,
            width: parseInt(this.details.width)-40,
            hideMode: 'offsets',
            autoScroll:true,
            layout: {
                type: 'fit'
            },            
            tabBar:{
                style: 'background:#fff;'
            },
            items: [
            {
                id   : 'filterTab',
                title: 'Filter',// TODO Do renaming of variables dataselection-->filter
                hideMode: 'offsets',
                autoScroll:true,
                html: "<div id='filterTabDiv' style='width:100%; height=100%;overflow:auto;'></div>"
            },
            {
                id : "dataTab",
                title: 'Dataselectie',// TODO Do renaming of variables filter->dataselection
                hideMode: 'offsets',
                autoScroll:true,
                html: "<div id='dataTabDiv' style='width:100%; height=100%;overflow:auto;'></div>"
            }
            ],
            activeTab : "dataTab",
            renderTo : this.getContentDiv()
        });
        
        // Make panels in tabs and save them
        this.dataTab = Ext.create('Ext.panel.Panel', {
            autoScroll: true,
            renderTo: 'dataTabDiv'
        });
        
        this.filterTab = Ext.create('Ext.panel.Panel', {
            autoScroll: true,
            renderTo: 'filterTabDiv'
        });
        
        // Add the button to the dataselectiontab
        var addFilter = Ext.create('Ext.Button', { 
            text : 'Voeg filter toe',
            listeners: {
                click:{
                    scope: this,
                    fn: this.addFilter
                }
            }
        });        
        this.filterTab.add(addFilter);
        this.filterActive = Ext.create ("Ext.form.field.Checkbox",{
            boxLabel  : 'Filter is actief',
            name      : 'filterActive',
            inputValue: true,
            checked   : false
                
        });
        this.filterTab.add(this.filterActive);
        // Add the first filter
        this.addFilter();
        // Make lower buttons
        this.button1 = Ext.create('Ext.Button', { 
            text : 'Toepassen',
            renderTo: this.getContentDiv(),
            listeners: {
                click:{
                    scope: this,
                    fn: this.applyFilter
                }
            }
        });
         
        this.button2 = Ext.create('Ext.Button', { 
            text : 'Annuleren',
            renderTo: this.getContentDiv(),
            listeners: {
                click:{
                    scope: this,
                    fn: this.cancel
                }
            }
        });
    },
    createDataTab : function (appLayer){
        var attributes = appLayer.attributes;
        var dataSelectieAttributes = new Array();
        for(var i= 0 ; i < attributes.length ;i++){
            var attribute = attributes[i];
            if(attribute.selectable){
                var defaultVal = "";
                if(attribute.defaultValue != undefined){
                    defaultVal = attribute.defaultValue; 
                }
                dataSelectieAttributes.push({
                    xtype: "textfield",
                    id: attribute.name,
                    name: attribute.name,
                    fieldLabel: attribute.alias || attribute.name,
                    labelWidth:200,
                    value : defaultVal
                });
            }
        }
        
        this.dataTab.removeAll();
        this.dataTab.add(dataSelectieAttributes);
    },
    /**
     *  Add a filter to the current filterlist.
     */
    addFilter : function (){
        var logicOperator = null;
        if(this.filters.length != 0){
            var logicStore = Ext.create('Ext.data.Store', {
                fields: ['id','title'],
                data : [{
                    id:"OR",
                    title:"of"
                }, {
                    id:"AND",
                    title:"en"
                }]
            });

            logicOperator = Ext.create('Ext.form.ComboBox', {
                fieldLabel: '',
                store: logicStore,
                queryMode: 'local',
                displayField: 'title',
                width:50,
                value:'OR',
                valueField: 'id'
            });
            // Insert before the checkbox
            this.filterTab.insert(this.filterTab.items.length - 1,logicOperator);
            
        }
        var config = {
            width: parseInt(this.details.width),
            height: parseInt(this.details.height),
            attributes:this.attributes,
            logicOperator:logicOperator
        };
        var filter = Ext.create("viewer.components.Filter",config);
        this.filters.push(filter);
        // Insert before the checkbox
        this.filterTab.insert(this.filterTab.items.length - 1,filter.getUI());
    },
    applyFilter : function (){
        var cql = "";
     
        cql += this.getDataTabCQL();
        if(this.filterActive.getValue()){
            if(cql != ""){
                cql += " AND ";
            }
            for ( var i = 0 ; i < this.filters.length;i++){
                var filter = this.filters[i];
                cql += filter.getCQL();
            }
        
        }
        if(cql != ""){
            cql = "(" + cql + ")";
        }
        var layerObj = this.layerSelector.getValue();
        var layer = this.viewerController.getApplayer(layerObj.serviceId, layerObj.name);
        
        var filterWrapper =  Ext.create("viewer.components.CQLFilterWrapper",{
            id: this.name + this.layerSelector.getValue(),
            cql: cql,
            operator : "AND"
        });
        
        this.viewerController.setFilter(filterWrapper,layer);
        
    //console.log("CQL: " + layer.filter.getCQL());
    },
    getDataTabCQL : function (){
        var items = this.dataTab.items.items;
        var cql = "";
        for ( var i = 0 ; i < items.length;i++){
            var item = items[i];
            if(item.getValue() != ""){
                if(i != 0 ){
                    cql += " AND ";
                }
                cql += "\"" +item.id + "\"=\'" + item.getValue() + "\'";
            }
        }
        return cql;
    },
    cancel : function (){
        this.popup.hide();
    },
    /**
     *  Reset all comboboxes when a different layer is selected
     */
    layerChanged : function (item,prev){
        this.appLayer = this.viewerController.getApplayer (item.serviceId,item.name);
        
        if(this.appLayer != null){
            this.featureService = this.viewerController.getAppLayerFeatureService(this.appLayer);
            var me = this;
            // check if featuretype was loaded
            if(this.appLayer.attributes == undefined) {
                this.featureService.loadAttributes(me.appLayer, function(attributes) {
                    me.changeAttributes(me.appLayer);
                });
            } else {
                this.changeAttributes(me.appLayer);
            }    
        }
        
        if(prev != undefined){
            var prevLayer = this.viewerController.getLayer (prev.serviceId,prev.name);
            prevLayer.setQuery(null);
        }
    },
    // Change the comboboxes of the attributefilters. Happens when a new layer is chosen.
    changeAttributes : function (appLayer){
        var attributes = appLayer.attributes;
        var attributeList = new Array();
        for(var i= 0 ; i < attributes.length ;i++){
            var attribute = attributes[i];
            if(attribute.filterable){
                attributeList.push({
                    id: attribute.id,
                    title: attribute.alias || attribute.name,
                    value: attribute.name
                });
            }
        }
        this.attributes = attributeList;
        for (var j = 0 ; j < this.filters.length ;j++){
            var filter = this.filters[j];
            filter.setNewAttributeList(attributeList);
        }
        this.createDataTab(appLayer);
    },
    getExtComponents: function() {
        return Ext.Array.merge(
            this.layerSelector.getExtComponents(),
            [
            this.tabpanel.getId(),
            this.dataTab.getId(),
            this.filterTab.getId(),
            this.button1.getId(),
            this.button2.getId()
            ]
            );
    }
});
