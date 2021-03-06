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
 * Custom configuration object for HTML configuration
 * @author <a href="mailto:roybraam@b3partners.nl">Roy Braam</a>
 */
Ext.define("viewer.components.CustomConfiguration",{
    extend: "viewer.components.SelectionWindowConfig",
    constructor: function (parentId,config){
        if (config === null){
            config = {};
        }
        config.showLabelconfig =true;
        viewer.components.CustomConfiguration.superclass.constructor.call(this, parentId,config);        
        this.createCheckBoxes(this.configObject.layers,{filterable: true});
        var me = this;
        this.form.add([{
                xtype: 'checkbox',
                fieldLabel: 'Filter direct na tekenen aanzetten',
                inputValue: true,
                name: 'applyDirect',
                checked: config.applyDirect!==undefined? config.applyDirect : true,
                value: true,
                labelWidth:me.labelWidth
            },
            {
                xtype: 'checkbox',
                fieldLabel: 'Meerdere geometrieën in één filter',
                inputValue: true,
                name: 'multiGeometries',
                checked: config.multiGeometries!==undefined? config.multiGeometries : false,
                value: false,
                labelWidth:me.labelWidth
            }
            ]);
    }
});

