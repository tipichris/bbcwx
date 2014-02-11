/* 
 * bbcwx - a Cinnamon Desklet displaying the weather retrieved
 * from the BBC's RSS feed.
 * 
 * Copyright 2014 Chris Hastie. Forked from accudesk@logan; original
 * code Copyright 2013 loganj. Includes the marknote library, Copyright
 * 2011 jbulb.org. Icons Copyright 2010 Merlin the Red. See help.html
 * for further credits and license information.
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

const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Desklet = imports.ui.desklet;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Clutter = imports.gi.Clutter;  
const GLib = imports.gi.GLib;
const Tweener = imports.ui.tweener;
const Util = imports.misc.util;
const Main = imports.ui.main;

const Tooltips = imports.ui.tooltips;
const PopupMenu = imports.ui.popupMenu;
const Cinnamon = imports.gi.Cinnamon;
const Settings = imports.ui.settings;

const Soup = imports.gi.Soup;

const UUID = "bbcwx@oak-wood.co.uk";
const DESKLET_DIR = imports.ui.deskletManager.deskletMeta[UUID].path;

imports.searchPath.push(DESKLET_DIR);
const xml = imports.marknote;

const _httpSession = new Soup.SessionAsync();
Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());

// Set up some constants for layout and styling
const TEXT_SIZE = 14;
const CC_TEXT_SIZE = 24;
const LABEL_TEXT_SIZE = 11;
const LINK_TEXT_SIZE = 9;
const REFRESH_ICON_SIZE=14;
const TABLE_ROW_SPACING=2;
const TABLE_COL_SPACING=5;
const TABLE_PADDING=5;
const CONTAINER_PADDING=12;
const ICON_HEIGHT = 40;
const ICON_WIDTH = 40;
const CC_ICON_HEIGHT =170;
const CC_ICON_WIDTH =170;
const BUTTON_PADDING=3;
const STYLE_POPUP_SEPARATOR_MENU_ITEM = 'popup-separator-menu-item';

function MyDesklet(metadata,desklet_id){
  this._init(metadata,desklet_id);
}

MyDesklet.prototype = {
  __proto__: Desklet.Desklet.prototype,
    

  _init: function(metadata,desklet_id){
    //############Variables###########
    this.desklet_id = desklet_id;
    this.daynames={Mon: _('Mon'),Tue: _('Tue'), Wed: _('Wed'), Thu: _('Thu'), Fri: _('Fri'), Sat: _('Sat'), Sun: _('Sun')};
    this.fwicons=[];this.labels=[];this.max=[];this.min=[];this.windd=[];this.winds=[];this.tempn=[];this.eachday=[];this.wxtooltip=[];
    this.cc=[];this.days=[];
    this.metadata = metadata;
    this.proces=false;
    this.userno=7; // number of days to show
    this.oldno=0; // test for a change in this.no
    this.oldwebservice='';
        
    //################################

    try {
      Desklet.Desklet.prototype._init.call(this, metadata);
      //#########################binding configuration file################
      this.settings = new Settings.DeskletSettings(this, UUID, this.desklet_id);                    
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"stationID","stationID",this.changeStation,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"units","units",this.updateStyle,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"wunits","wunits",this.updateStyle,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"punits","punits",this.updateStyle,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"transparency","transparency",this.updateStyle,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"textcolor","textcolor",this.updateStyle,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"bgcolor","bgcolor",this.updateStyle,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"zoom","zoom",this.updateStyle,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"border","border",this.updateStyle,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"bordercolor","bordercolor",this.updateStyle,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"layout","layout",this.updateStyle,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"iconstyle","iconstyle",this.updateStyle,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"citystyle","citystyle",this.updateStyle,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"webservice","webservice",this.initForecast,null);


      this.helpFile = DESKLET_DIR + "/help.html"; 
      this._menu.addAction(_("Help"), Lang.bind(this, function() {
        Util.spawnCommandLine("xdg-open " + this.helpFile);
      }));

           
      this.proces=true;
    
      this.initForecast();
      
    }
    catch (e) {
      global.logError(e);
    }
    return true;
  },

  //##########################REFRESH#########################  
    
  updateStyle: function() {
    this._update_style();
    // also need to run these to update icon style and size
    this.displayForecast();
    this.displayCurrent();
  },
  
  _update_style: function() {
    //global.log("bbcwx (instance " + this.desklet_id + "): entering _update_style");
    let fcap = this.service.capabilities.forecast;
    this.window.vertical = (this.layout==1) ? true : false;
    this.cwicon.height=CC_ICON_HEIGHT*this.zoom;this.cwicon.width=CC_ICON_WIDTH*this.zoom;
    this.weathertext.style= 'text-align : center; font-size:'+CC_TEXT_SIZE*this.zoom+'px';
    this.fwtable.style="spacing-rows: "+TABLE_ROW_SPACING*this.zoom+"px;spacing-columns: "+TABLE_COL_SPACING*this.zoom+"px;padding: "+TABLE_PADDING*this.zoom+"px;";
    this.cityname.style="text-align: center;font-size: "+TEXT_SIZE*this.zoom+"px; font-weight: " + ((this.citystyle) ? 'bold' : 'normal') + ";" ;    
    this.ctemp_captions.style = 'text-align : right;font-size: '+TEXT_SIZE*this.zoom+"px";
    this.ctemp_values.style = 'text-align : left; font-size: '+TEXT_SIZE*this.zoom+"px";
    
    if (this.border) {
      this.window.style="border: 2px solid "+this.bordercolor+"; border-radius: 12px; background-color: "+(this.bgcolor.replace(")",","+this.transparency+")")).replace('rgb','rgba')+"; color: "+this.textcolor;
    }
    else {
      this.window.style="border-radius: 12px; background-color: "+(this.bgcolor.replace(")",","+this.transparency+")")).replace('rgb','rgba')+"; color: "+this.textcolor;
    }
    this._separatorArea.height=5*this.zoom;

    for(let f=0;f<this.no;f++) {
      this.labels[f].style='text-align : center;font-size: '+TEXT_SIZE*this.zoom+"px";
      this.fwicons[f].height=ICON_HEIGHT*this.zoom;this.fwicons[f].width= ICON_WIDTH*this.zoom;
      if(this.max[f]) this.max[f].style= 'text-align : center; font-size: '+TEXT_SIZE*this.zoom+"px";
      if( this.min[f]) this.min[f].style= 'text-align : center; font-size: '+TEXT_SIZE*this.zoom+"px";
      if(this.winds[f]) this.winds[f].style= 'text-align : center; font-size: '+TEXT_SIZE*this.zoom+"px";
      if(this.windd[f]) this.windd[f].style= 'text-align : center; font-size: '+TEXT_SIZE*this.zoom+"px";
    }
    
    this.buttons.style="padding-top:"+BUTTON_PADDING*this.zoom+"px;padding-bottom:"+BUTTON_PADDING*this.zoom+"px";
    
    this.iconbutton.icon_size=REFRESH_ICON_SIZE*this.zoom;
    this.banner.style='font-size: '+LINK_TEXT_SIZE*this.zoom+"px; color: " + this.textcolor;
    this.bannerpre.style='font-size: '+LINK_TEXT_SIZE*this.zoom+"px; color: " + this.textcolor; 
    
    let forecastlabels = ['maxlabel', 'minlabel', 'windlabel', 'winddlabel'];
    for (let i = 0; i<forecastlabels.length; i++) {
      if (this[forecastlabels[i]]) this[forecastlabels[i]].style = 'text-align : right;font-size: '+LABEL_TEXT_SIZE*this.zoom+"px";
    }
    
    this.cweather.style='padding: ' + CONTAINER_PADDING*this.zoom+'px';
    if (this.layout==1) {
      // loose the top padding on container in vertical mode (too much space)
      this.container.style='padding: 0 ' + CONTAINER_PADDING*this.zoom+'px ' + CONTAINER_PADDING*this.zoom+'px ' + CONTAINER_PADDING*this.zoom+'px ' ;
    } else {
      this.container.style='padding: ' + CONTAINER_PADDING*this.zoom+'px';
    }
    
  },
  
  createwindow: function(){
    
    this.window=new St.BoxLayout({vertical: ((this.layout==1) ? true : false)});
    
    // container for link and refresh icon
    this.buttons=new St.BoxLayout({vertical: false,style: "padding-top:"+BUTTON_PADDING*this.zoom+"px;padding-bottom:"+BUTTON_PADDING*this.zoom+"px",x_align:2, y_align:2 });
    // refresh icon
    this.iconbutton=new St.Icon({ icon_name: 'view-refresh-symbolic',
      icon_size: REFRESH_ICON_SIZE*this.zoom+'',
      icon_type: St.IconType.SYMBOLIC,
      style: "padding: 0 0 0 3px;"
    });
    this.but=new St.Button(); // container for refresh icon
    
    // these will hold the data for the three day forecast
    this.labels=[]; this.fwicons=[];this.max=[]; this.min=[]; this.windd=[]; this.winds=[]; this.eachday=[];
    
    // some labels need resetting incase we are redrawing after a change of service
    this.humidity=null; this.pressure=null; this.windspeed=null; this.feelslike=null;
    
    this._separatorArea = new St.DrawingArea({ style_class: STYLE_POPUP_SEPARATOR_MENU_ITEM });
    
    let ccap = this.service.capabilities.cc;
    
    // current weather values
    if(ccap.humidity) this.humidity=new St.Label();
    if(ccap.pressure) this.pressure=new St.Label();
    if(ccap.wind_speed) this.windspeed=new St.Label();
    if(ccap.feelslike) this.feelslike=new St.Label();
    
    // container for current weather values
    this.ctemp_values = new St.BoxLayout({vertical: true, style : 'text-align : left; font-size: '+TEXT_SIZE*this.zoom+"px"});
    // container for current weather labels
    this.ctemp_captions = new St.BoxLayout({vertical: true,style : 'text-align : right'});
    // container for current weather
    this.ctemp = new St.BoxLayout({vertical: false,x_align: 2});
    
    // city and city container
    this.cityname=new St.Label({style: "text-align: center;font-size: "+TEXT_SIZE*this.zoom+"px" });
    this.city=new St.BoxLayout({vertical:true,style: "align: center;"});
    
    // container for right (horizontal) or lower (vertical) part of window
    this.container= new St.BoxLayout({vertical: true, x_align: 2});//definire coloana dreapta
    // container for left (horizontal) or upper (vertical) part of window
    this.cweather = new St.BoxLayout({vertical: true, x_align: 2}); //definire coloana stangz
    // current weather icon container
    this.cwicon = new St.Bin({height: (CC_ICON_HEIGHT*this.zoom), width: (CC_ICON_WIDTH*this.zoom)}); //icoana mare cu starea vremii
    // current weather text
    this.weathertext=new St.Label({style: 'text-align : center; font-size:'+CC_TEXT_SIZE*this.zoom+'px'}); //-textul cu starea vremii de sub ditamai icoana :)
    
    this.city.add_actor(this.cityname); 

    if(ccap.humidity) this.ctemp_captions.add_actor(new St.Label({text: _('Humidity: ')}));
    if(ccap.pressure) this.ctemp_captions.add_actor(new St.Label({text: _('Pressure: ')}));
    if(ccap.wind_speed) this.ctemp_captions.add_actor(new St.Label({text: _('Wind: ')}));
    if(ccap.feelslike) this.ctemp_captions.add_actor(new St.Label({text: _('Feels like: ')}));
    
    if(this.humidity) this.ctemp_values.add_actor(this.humidity);
    if(this.pressure) this.ctemp_values.add_actor(this.pressure);
    if(this.windspeed) this.ctemp_values.add_actor(this.windspeed);
    if(this.feelslike) this.ctemp_values.add_actor(this.feelslike);
    
    this.ctemp.add_actor(this.ctemp_captions); //-adauga coloana din stanga la informatii
    this.ctemp.add_actor(this.ctemp_values);  //adauga coloana din dreapta la informatii     
    
    // build table to hold three day forecast
    this.fwtable =new St.Table({style: "spacing-rows: "+TABLE_ROW_SPACING*this.zoom+"px;spacing-columns: "+TABLE_COL_SPACING*this.zoom+"px;padding: "+TABLE_PADDING*this.zoom+"px;"});
    this.maxlabel = new St.Label({text: _('Max:'), style: 'text-align : right;font-size: '+LABEL_TEXT_SIZE*this.zoom+"px"});
    this.minlabel = new St.Label({text: _('Min:'), style: 'text-align : right;font-size: '+LABEL_TEXT_SIZE*this.zoom+"px"});
    this.windlabel = new St.Label({text: _('Wind:'), style: 'text-align : right;font-size: '+LABEL_TEXT_SIZE*this.zoom+"px"});
    this.winddlabel = new St.Label({text: _('Dir:'), style: 'text-align : right;font-size: '+LABEL_TEXT_SIZE*this.zoom+"px"});
    
    let fcap = this.service.capabilities.forecast;
    let row = 2;
    
    if(fcap.maximum_temperature) {this.fwtable.add(this.maxlabel,{row:row,col:0}); row++}
    if(fcap.minimum_temperature) {this.fwtable.add(this.minlabel,{row:row,col:0}); row++}
    if(fcap.wind_speed) {this.fwtable.add(this.windlabel,{row:row,col:0}); row++}
    if(fcap.wind_direction) {this.fwtable.add(this.winddlabel,{row:row,col:0}); row++}
    for(let f=0;f<this.no;f++) {
      this.labels[f]=new St.Button({label: '', style: 'color: ' + this.textcolor + ';text-align: center;font-size: '+TEXT_SIZE*this.zoom+"px" });
      this.fwicons[f]=new St.Button({height:ICON_HEIGHT*this.zoom, width: ICON_WIDTH*this.zoom});
      if(fcap.maximum_temperature) this.max[f]=new St.Label({style: 'text-align : center;font-size: '+TEXT_SIZE*this.zoom+"px"});
      if(fcap.minimum_temperature) this.min[f]=new St.Label({style: 'text-align : center;font-size: '+TEXT_SIZE*this.zoom+"px"});
      if(fcap.wind_speed) this.winds[f]=new St.Label({style: 'text-align : center;font-size: '+TEXT_SIZE*this.zoom+"px"});
      if(fcap.wind_direction) this.windd[f]=new St.Label({style: 'text-align : center;font-size: '+TEXT_SIZE*this.zoom+"px"});
      this.wxtooltip[f] = new Tooltips.Tooltip(this.fwicons[f]);
      
      this.fwtable.add(this.labels[f],{row:0,col:f+1});
      this.fwtable.add(this.fwicons[f],{row:1,col:f+1});
      row = 2;
      if(this.max[f]) {this.fwtable.add(this.max[f],{row:row,col:f+1}); row++}
      if(this.min[f]) {this.fwtable.add(this.min[f],{row:row,col:f+1}); row++}
      if(this.winds[f]) {this.fwtable.add(this.winds[f],{row:row,col:f+1}); row++}
      if(this.windd[f]) {this.fwtable.add(this.windd[f],{row:row,col:f+1}); row++}
    }
    
    this.but.set_child(this.iconbutton);
    this.but.connect('clicked', Lang.bind(this, this.updateForecast));
    // seems we have to use a button for bannerpre to get the vertical alignment :(
    this.bannerpre=new St.Button({label: _('Data from '), style: 'font-size: '+LINK_TEXT_SIZE*this.zoom+"px; color: " + this.textcolor + ";"});
    this.banner=new St.Button({ 
      style: 'font-size: '+LINK_TEXT_SIZE*this.zoom+"px; color: " + this.textcolor + ";",
      reactive: true,
      track_hover: true,
      style_class: 'bbcwx-link'});
    this.bannertooltip = new Tooltips.Tooltip(this.banner);
    this.refreshtooltip = new Tooltips.Tooltip(this.but, _('Refresh'));
    this.buttons.add_actor(this.bannerpre);
    this.buttons.add_actor(this.banner);
    this.buttons.add_actor(this.but);
    this.container.add_actor(this.ctemp);  
    this.container.add_actor(this._separatorArea);
    this.container.add_actor(this.fwtable); 
    this.cweather.add_actor(this.city);
    this.cweather.add_actor(this.cwicon);
    this.cweather.add_actor(this.weathertext);
    this.container.add_actor(this.buttons);
    this.window.add_actor(this.cweather);
    this.window.add_actor(this.container);
    
  },
  
  updateForecast: function() {
    this._refreshweathers();
  },
  
  changeStation: function() {
    this.service.setStation(this.stationID);
    this._refreshweathers();
  },
  
  initForecast: function() {
    global.log("bbcwx (instance " + this.desklet_id + "): entering initForecast");
    if (this.service) delete this.service;
    if (this.proces) {
      switch(this.webservice) {
        case 'bbc':
          this.service = new wxDriverBBC(this.stationID);
          break;
        case 'mock':
          this.service = new wxDriverMock(this.stationID);
          break;
        case 'yahoo':
          this.service = new wxDriverYahoo(this.stationID);
          break;
        default:
          this.service = new wxDriverBBC(this.stationID);
      }
      //global.log("bbcwx (instance " + this.desklet_id + "): capabilities: " + print_r(this.service.capabilities));
      if (this.userno > this.service.maxDays) {
        this.no = this.service.maxDays;
      } else {
        this.no = this.userno;
      }
      if((this.no != this.oldno) || (this.oldwebservice != this.webservice)) {
        global.log("bbcwx (instance " + this.desklet_id + "): recreating window");
        //global.log("bbcwx (instance " + this.desklet_id + "): capabilities: " + print_r(this.service.capabilities));
        this.createwindow(); 
        this.oldno=this.no;
        this.oldwebservice = this.webservice;
        this.setContent(this.window);
      }
      this._update_style();
      this._refreshweathers();    
    }
  },
  
  _refreshweathers: function() {
    let now=new Date().toLocaleFormat('%H:%M:%S');
    global.log("bbcwx (instance " + this.desklet_id + "): refreshing forecast at " + now);
    this.service.showType();
    //global.log(print_r(this.service.data));
    this.service.refreshData(this);  
    
    if(this._timeoutId != undefined) {
      Mainloop.source_remove(this._timeoutId);
    }
    
    this._timeoutId=Mainloop.timeout_add_seconds(1500 + Math.round(Math.random()*600), Lang.bind(this, this.updateForecast));
  },
  
  displayForecast: function() {
    global.log("bbcwx (instance " + this.desklet_id + "): entering displayForecast");
    //global.log("bbcwx (instance " + this.desklet_id + "): forecasts: " +print_r(this.service.data.days));
    for(f=0;f<this.no;f++)
    {
      let day = this.service.data.days[f];
      //global.log("Data: " + print_r(day));
      this.labels[f].label=((this.daynames[day.day]) ? this.daynames[day.day] : '');
      let fwiconimage = this._getIconImage(day.icon);
      fwiconimage.set_size(ICON_WIDTH*this.zoom, ICON_HEIGHT*this.zoom);
      this.fwicons[f].set_child(fwiconimage);      
      this.wxtooltip[f].set_text(((day.weathertext) ? _(day.weathertext) : _('No data available')));
      if(this.max[f]) this.max[f].text=this._formatTemperature(day.maximum_temperature, true);
      if(this.min[f]) this.min[f].text=this._formatTemperature(day.minimum_temperature, true);
      if(this.winds[f]) this.winds[f].text=this._formatWindspeed(day.wind_speed, true);
      if(this.windd[f]) this.windd[f].text= ((day.wind_direction) ? _(day.wind_direction) : '');     
    }
  },
  
  displayCurrent: function(){
    //global.log("bbcwx (instance " + this.desklet_id + "): entering displayCurrent");
    let cc = this.service.data.cc;
    let cwimage=this._getIconImage(this.service.data.cc.icon);
    cwimage.set_size(CC_ICON_WIDTH*this.zoom, CC_ICON_HEIGHT*this.zoom);
    this.cwicon.set_child(cwimage);
    this.weathertext.text = ((cc.weathertext) ? _(cc.weathertext) : '') + ((cc.temperature && cc.weathertext) ? ', ' : '' )+ this._formatTemperature(cc.temperature, true) ;
    if (this.humidity) this.humidity.text= this._formatHumidity(cc.humidity);
    if (this.pressure) this.pressure.text=this._formatPressure(cc.pressure, cc.pressure_direction, true);
    if (this.windspeed) this.windspeed.text=((cc.wind_direction) ? _(cc.wind_direction) + ", " : '') + this._formatWindspeed(cc.wind_speed, true);      
    if (this.feelslike) this.feelslike.text=this._formatTemperature(cc.feelslike, true) ;
  },
  
  displayMeta: function() {
    this.cityname.text=this.service.data.city;
    this.banner.label = this.service.linkText;
    this.bannertooltip.set_text(this.service.linkTooltip);
    //global.log('Tooltip: ' + this.service.linkTooltip);
    try {
      if(this.bannersig) this.bannersig.disconnect();
    } catch(e) { }
    
    this.bannersig = this.banner.connect('clicked', Lang.bind(this, function() {
        Util.spawnCommandLine("xdg-open " + this.service.linkURL );
    }));
  },
  
  _getIconImage: function(iconcode) {
    let icon_name = 'na';
    let icon_ext = '.png';
    if (iconcode) {
      icon_name = iconcode;
    }
      
    let icon_file = DESKLET_DIR + '/icons/' + this.iconstyle +'/' + icon_name + icon_ext;
    let file = Gio.file_new_for_path(icon_file);
    let icon_uri = file.get_uri();
    
    return St.TextureCache.get_default().load_uri_async(icon_uri, 200*this.zoom, 200*this.zoom);
  },
  
  // take a string with both C and F and extract the required 
  // value. Append unit string if units is true
  _formatTemperature: function(temp, units) {
    units = typeof units !== 'undefined' ? units : false;
    if (!temp.toString().length) return ''; 
    let celsius = 1*temp;
    let fahr = ((celsius + 40) * 1.8) - 40;
    let out = Math.round(((this.units==1) ? celsius : fahr));
    if (units) {
      out += ((this.units==1) ? _("\u2103") : _("\u2109"))
    }
    return out;
  },

  // take a wind speed in km/h and convert to required 
  // units. Append unit string if units is true
  _formatWindspeed: function(wind, units) {
    units = typeof units !== 'undefined' ? units : false;
    if (typeof wind === 'undefined') return '';
    if (!wind.toString().length) return '';
    let conversion = {
      'mph': 0.621,
      'knots': 0.54,
      'kph': 1,
      'mps': 0.278
    };
    let unitstring = {
      'mph': _('mph'),
      'knots': _('kts'),
      'kph': _('km/h'),
      'mps': _('m/s')
    }
    let kph = 1*wind;
    let out = kph * conversion[this.wunits];
    out = out.toFixed(0);
    if (units) {
      out += unitstring[this.wunits];
    }
    return out;
  },
  
  // -> pressure: real, pressure (in mb)
  // -> direction: string, direction of travel, or false
  // -> units: boolean, append units
  _formatPressure: function(pressure, direction, units) {
    units = typeof units !== 'undefined' ? units : false;
    if (!pressure.toString().length) return '';
    let conversion = {
      'mb': 1,
      'in': 0.02953,
      'mm': 0.75
    };
    let unitstring = {
      'mb': _('mb'),
      'in': _('in'),
      'mm': _('mm')
    };
    let precission = {
      'mb': 0,
      'in': 2,
      'mm': 0
    };
    let mb = 1*pressure;
    let out = mb * conversion[this.punits];
    out = out.toFixed(precission[this.punits]);
    if (units) {
      out += unitstring[this.punits];;
    }
    if (direction) {
      out += ', ' + _(direction);
    }
    return out;
  },
  
  _formatHumidity: function(humidity) {
    if (!humidity.toString().length) return '';
    return 1*humidity + '%';
  },

  on_desklet_removed: function() {
    if(this._timeoutId != undefined) {
      Mainloop.source_remove(this._timeoutId);
    }
  }
  
    
};

// a base driver class. This is overridden
// by drivers that actually do the work
function wxDriver(stationID) {
  this._init(stationID);
};

wxDriver.prototype = {
  // name of the driver
  drivertype: 'Base',
  // URL for credit link
  linkURL: '',
  // text for credit link
  linkText: '',
  // tooltip for credit link
  linkTooltip: 'Click for more information',
  // the maximum number of days of forecast supported 
  // by this driver
  maxDays : 1,
  

  
  // initialise
  _init: function(stationID) {
    this.stationID = stationID;
    
    // a list of capabilities supported by the driver
    // we set them all to true here and expect any children
    // to disable those they don't support
    this.capabilities = {
      cc: {
        humidity: true,
        temperature: true,
        pressure: true,
        pressure_direction: true,
        wind_speed: true,
        wind_direction: true,
        obstime: true,
        weathertext: true,
        visibility: true,
        feelslike: true
      },
      forecast: {
        humidity: true,
        maximum_temperature: true,
        minimum_temperature: true,
        pressure: true,
        pressure_direction: true,
        wind_speed: true,
        wind_direction: true,
        weathertext: true,
        visibility: true,
        uv_risk: true
      },
      meta: {
        city: true,
        country: true,
        region: true
      }
    };
    
    this.data=new Object();
    this._emptyData();
  },
  
  // empty out this.data
  _emptyData: function() {
    this.data.city = '';
    this.data.country = '';
    this.data.days=[];
    delete this.data.cc;
    this.data.cc = new Object();
    this.data.cc.wind_direction = '';
    this.data.cc.wind_speed = '';
    this.data.cc.pressure = '';
    this.data.cc.pressure_direction = '';
    this.data.cc.temperature = '';
    this.data.cc.humidity = '';
    this.data.cc.visibility = '';
    this.data.cc.obstime = '';
    this.data.cc.weathertext = '';
    this.data.cc.icon = '';
    this.data.cc.feelslike = '';
    for(let i=0; i<this.maxDays; i++) {
      let day = new Object();
      day.day = '';
      day.weathertext = '';
      day.icon = '';
      day.maximum_temperature ='';
      day.minimum_temperature = '';
      day.wind_direction = '';
      day.wind_speed = '';
      day.visibility = '';
      day.pressure = '';
      day.humidity = '';
      day.uv_risk = '';
      day.pollution = '';
      day.sunrise = '';
      day.sunset = '';
      delete this.data.days[i];
      this.data.days[i] = day;
    };
  },
  
  // change the stationID
  setStation: function(stationID) {
    this.stationID = stationID;
  },
  
  // for debugging. Log the driver type
  showType: function() {
    global.log('Using driver type: ' + this.drivertype);
  },

  // async call to retrieve rss feed. 
  // -> url: url to call
  _getWeather: function(url, callback) {
    var here = this;
    let message = Soup.Message.new('GET', url);
    _httpSession.queue_message(message, function (session, message) {
      if( message.status_code == 200) {
        let mes = message.response_body.data;
        callback.call(here,mes.toString()); 
      } else {
        global.logWarning("Error retrieving address " + url + ". Status: " + message.status_code);
        callback.call(here,false);
      }
    });
  }, 

  // stub function to be overridden by child classes. deskletObj is a reference
  // to the main object. It is passed to allow deskletObj.displayForecast()
  // deskletObj.displayMeta() and deskletObj.displayCurrent() to be called from
  // within callback functions.
  refreshData: function(deskletObj) {
  },

  compassDirection: function(deg) {
    let directions = ['N', 'NNE','NE', 'ENE','E', 'ESE','SE','SSE', 'S','SSW', 'SW', 'WSW','W','WNW', 'NW','NNW'];
    return directions[Math.round(deg / 22.5) % directions.length];
  }


};


function wxDriverBBC(stationID) {
  this._bbcinit(stationID);
};

wxDriverBBC.prototype = {
  __proto__: wxDriver.prototype,
  
  drivertype: 'BBC',
  maxDays: 3, 
  linkText: 'www.bbc.co.uk/weather',
  
  // these will be dynamically reset when data is loaded
  linkURL: 'http://www.bbc.co.uk/weather/',
  linkTooltip: 'Visit the BBC weather website',
  
  _baseURL: 'http://open.live.bbc.co.uk/weather/feeds/en/',
  
  // initialise the driver
  _bbcinit: function(stationID) {
    this._init(stationID);
    this.capabilities.meta.region =  false;
    this.capabilities.cc.feelslike = false;
  },
  
  refreshData: function(deskletObj) {
    // reset the data object
    this._emptyData();
    this.linkTooltip = 'Visit the BBC weather website';
    this.linkURL = 'http://www.bbc.co.uk/weather';
    
    // process the three day forecast
    let a = this._getWeather(this._baseURL + this.stationID + '/' + '3dayforecast' + '.rss', function(weather) {
      if (weather) {
        this._load_forecast(weather);
      }
      // get the main object to update the display
      deskletObj.displayForecast();
      deskletObj.displayMeta();
    });

    // process current observations
    let b = this._getWeather(this._baseURL + this.stationID + '/' + 'observations' + '.rss', function(weather) {
      if (weather) {
        this._load_observations(weather); 
      }
      // get the main object to update the display
      deskletObj.displayCurrent();      
    });    
    
  },
  
  // process the rss for a 3dayforecast and populate this.data
  _load_forecast: function (rss) {
    //global.log('_load_days called with: ' + rss);
    //global.log("Prototype: " + Object.getPrototypeOf(this));
    let days = [];
    
    let parser = new marknote.Parser();
    let doc = parser.parse(rss);

    let rootElem = doc.getRootElement();
    let channel = rootElem.getChildElement("channel");
    let location = channel.getChildElement("title").getText().split("Forecast for")[1].trim();
    this.data.city = location.split(',')[0].trim();
    this.data.country = location.split(',')[1].trim();
    this.linkTooltip = 'Click here to see the full forecast for ' + this.data.city;
    this.linkURL = channel.getChildElement("link").getText();
    let items = channel.getChildElements("item");
    let desc, title;

    for (let i=0; i<items.length; i++) {
      let data = new Object();
      desc = items[i].getChildElement("description").getText();
      title = items[i].getChildElement("title").getText();
      data.link = items[i].getChildElement("link").getText();
      data.day = title.split(':')[0].trim().substring(0,3);
      data.weathertext = title.split(':')[1].split(',')[0].trim();
      let parts = desc.split(',');
      let k, v;
      for (let b=0; b<parts.length; b++) {
        k = parts[b].slice(0, parts[b].indexOf(':')).trim().replace(' ', '_').toLowerCase();
        v = parts[b].slice(parts[b].indexOf(':')+1).trim();
        if (v.toLowerCase() == 'null') v = '';
        if (k == "wind_direction") {
          let vparts = v.split(" ");
          v = '';
          for (let c=0; c<vparts.length; c++) {
            v += vparts[c].charAt(0).toUpperCase();
          }
        }
        data[k] = v;
      }
      data.maximum_temperature = this._getTemperature(data.maximum_temperature);
      data.minimum_temperature = this._getTemperature(data.minimum_temperature);
      data.wind_speed = this._getWindspeed(data.wind_speed);
      data.pressure = data.pressure.replace('mb', '');
      data.humidity = data.humidity.replace('%', '');
      data.icon = this._getIconFromText(data.weathertext);
      this.data.days[i] = data;
    }
  },

  // take an rss feed of current observations and extract data into this.data
  _load_observations: function (rss) {
    //global.log('_set_cc called with: ' + rss);
    let parser = new marknote.Parser();
    let doc = parser.parse(rss);
    let rootElem = doc.getRootElement();
    let channel = rootElem.getChildElement("channel");
    let item = channel.getChildElement("item");
    let desc = item.getChildElement("description").getText();
    let title = item.getChildElement("title").getText();
    desc = desc.replace('mb,', 'mb|');
    this.data.cc.weathertext = title.split(':')[2].split(',')[0].trim();
    if (this.data.cc.weathertext.toLowerCase() == 'null') this.data.cc.weathertext = '';
    let parts = desc.split(',');
    for (let b=0; b<parts.length; b++) {
      let k, v;
      k = parts[b].slice(0, parts[b].indexOf(':')).trim().replace(' ', '_').toLowerCase();
      v = parts[b].slice(parts[b].indexOf(':')+1).trim();
      if (v.toLowerCase() == 'null') v = '';
      if (k == "wind_direction") {
        let vparts = v.split(" ");
        v = '';
        for (let c=0; c<vparts.length; c++) {
          v += vparts[c].charAt(0).toUpperCase();
        }
      }
      if (k == "pressure") {
        let pparts=v.split('|');
        v = pparts[0].trim();
        this.data.cc.pressure_direction = pparts[1].trim();
      }      
      this.data.cc[k] = v;
    }
    this.data.cc.icon = this._getIconFromText(this.data.cc.weathertext);
    this.data.cc.temperature = this._getTemperature(this.data.cc.temperature);
    this.data.cc.wind_speed = this._getWindspeed(this.data.cc.wind_speed);
    this.data.cc.humidity = this.data.cc.humidity.replace('%', '');
    this.data.cc.pressure = this.data.cc.pressure.replace('mb', '');
  },
  
  _getIconFromText: function(wxtext) {
    let icon_name = 'na';
    let iconmap = {
      'clear sky' : '00', //night
      'sunny' : '01',
      'partly cloudy' : '02',  //night
      'sunny intervals' : '03',
      'sand storm' : '04', // not confirmed
      'mist' : '05',
      'fog' : '06',
      'white cloud' : '07',
      'light cloud' : '07',
      'grey cloud' : '08',
      'thick cloud' : '08',
      'light rain shower' : '10',
      'drizzle' : '11',
      'light rain' : '12',
      'heavy rain shower' : '14',
      'heavy rain' : '15',
      'sleet shower' : '17',
      'sleet' : '18',
      'light snow shower' : '23',
      'light snow' : '24',
      'heavy snow shower' : '26',
      'heavy snow' : '27',
      'thundery shower' : '29',
      'thunder storm' : '30',
      'thunderstorm' : '30',
      'hazy' : '32'
    }
    if (wxtext) {
      wxtext = wxtext.toLowerCase();
      if (typeof iconmap[wxtext] !== "undefined") {
        icon_name = iconmap[wxtext];
      }
    }
    return icon_name;
  },
  
  _getTemperature: function(temp) {
    if (!temp) return ''; 
    let celsius = temp.slice(0, temp.indexOf('C')-1).trim();
    return celsius;
  },
  
  _getWindspeed: function(wind) {
    if (!wind) return '';
    let mph = wind.replace('mph', '');
    let out = mph * 1.6;
    return out;
  },

  _getPressure: function(pressure) {
    if (!pressure) return '';
    let parts = pressure.split(', ');
    let number = parts[0].trim().replace('mb', '');
    let trajectory = parts[1].trim();
    out = number;
    if (units) {
      out += _('mb');
    }
    out += ', ' + _(trajectory);
    return out;
  },

};  

function wxDriverYahoo(stationID) {
  this._yahooinit(stationID);
};

wxDriverYahoo.prototype = {
  __proto__: wxDriver.prototype,
  
  drivertype: 'Yahoo',
  maxDays: 5, 
  linkText: 'Yahoo! Weather',
  
  // these will be dynamically reset when data is loaded
  linkURL: 'http://weather.yahoo.com',
  linkTooltip: 'Visit the Yahoo! Weather website',
  
  _baseURL: 'http://weather.yahooapis.com/forecastrss?u=c&w=',
  
  // initialise the driver
  _yahooinit: function(stationID) {
    this._init(stationID);
    this.capabilities.forecast.wind_direction =  false;
    this.capabilities.forecast.wind_speed =  false;
    this.capabilities.forecast.pressure =  false;
    this.capabilities.forecast.pressure_direction =  false;
    this.capabilities.forecast.visibility =  false;
    this.capabilities.forecast.uv_risk =  false;
    this.capabilities.forecast.humidity =  false;   
  },
  
  refreshData: function(deskletObj) {
    // reset the data object
    this._emptyData();
    this.linkTooltip = 'Visit the Yahoo! Weather website';
    this.linkURL = 'http://weather.yahoo.com/';
    
    // process the three day forecast
    let a = this._getWeather(this._baseURL + this.stationID, function(weather) {
      if (weather) {
        this._load_forecast(weather);
      }
      // get the main object to update the display
      global.log("Yahoo data: " + print_r(this.data));
      deskletObj.displayCurrent();  
      deskletObj.displayMeta();
      deskletObj.displayForecast();
    });   
    
  },
  
  // process the rss for a 3dayforecast and populate this.data
  _load_forecast: function (rss) {
    //global.log('Yahoo _load_days called with: ' + rss);
    //global.log("Prototype: " + Object.getPrototypeOf(this));
    let days = [];
    
    let parser = new marknote.Parser();
    let doc = parser.parse(rss);

    let rootElem = doc.getRootElement();
    let channel = rootElem.getChildElement("channel");

    let geo = channel.getChildElement('yweather:location');
    let wind = channel.getChildElement('yweather:wind');
    let atmosphere = channel.getChildElement('yweather:atmosphere');


    let pressurecodes = ['Steady', 'Rising', 'Falling'];

    this.data.city = geo.getAttributeValue('city');
    this.data.region = geo.getAttributeValue('region');
    this.data.country = geo.getAttributeValue('country');


    this.data.cc.wind_speed = wind.getAttributeValue('speed');
    this.data.cc.wind_direction = this.compassDirection(wind.getAttributeValue('direction'));
    this.data.cc.pressure = atmosphere.getAttributeValue('pressure');
    this.data.cc.pressure_direction = pressurecodes[atmosphere.getAttributeValue('rising')];
    this.data.cc.humidity = atmosphere.getAttributeValue('humidity');


    let items = channel.getChildElements("item");
    let conditions = items[0].getChildElement('yweather:condition');

    this.data.cc.temperature = conditions.getAttributeValue('temp');
    this.data.cc.obstime = conditions.getAttributeValue('date');
    this.data.cc.weathertext = conditions.getAttributeValue('text');
    this.data.cc.icon = conditions.getAttributeValue('code');
    this.data.cc.feelslike = this.data.cc.temperature - wind.getAttributeValue('chill');
    
    this.linkURL = items[0].getChildElement('link').getText();
    this.linkTooltip = 'Click here to see the full forecast for ' + this.data.city; 

    let forecasts = items[0].getChildElements('yweather:forecast');

    for ( let i=0; i<forecasts.length; i++) {
      day = new Object();
      day.day = forecasts[i].getAttributeValue('day');
      day.maximum_temperature = forecasts[i].getAttributeValue('high');
      day.minimum_temperature = forecasts[i].getAttributeValue('low');
      day.weathertext = forecasts[i].getAttributeValue('text');
      day.icon = forecasts[i].getAttributeValue('code');
      this.data.days[i] = day;
    }    
  },
  
  _mapicon: function(code) {
    let icon_name = 'na';
    let iconmap = {
      'clear sky' : '00', //night
      'sunny' : '01',
      'partly cloudy' : '02',  //night
      'sunny intervals' : '03',
      'sand storm' : '04', // not confirmed
      'mist' : '05',
      'fog' : '06',
      'white cloud' : '07',
      'light cloud' : '07',
      'grey cloud' : '08',
      'thick cloud' : '08',
      'light rain shower' : '10',
      'drizzle' : '11',
      'light rain' : '12',
      'heavy rain shower' : '14',
      'heavy rain' : '15',
      'sleet shower' : '17',
      'sleet' : '18',
      'light snow shower' : '23',
      'light snow' : '24',
      'heavy snow shower' : '26',
      'heavy snow' : '27',
      'thundery shower' : '29',
      'thunder storm' : '30',
      'thunderstorm' : '30',
      'hazy' : '32'
    }
    if (wxtext) {
      wxtext = wxtext.toLowerCase();
      if (typeof iconmap[wxtext] !== "undefined") {
        icon_name = iconmap[wxtext];
      }
    }
    return icon_name;
  },
  
};  

function wxDriverMock(stationID) {
  this._init(stationID);
};

wxDriverMock.prototype = {
  __proto__: wxDriver.prototype,
  
  drivertype: 'Mock',
  
  linkText: 'Foo',
  
  maxDays: 6,
  
  linkURL: 'http://foo.com',
  
  refreshData: function(deskletObj) { 
    this.mockData();
    deskletObj.displayCurrent();
    deskletObj.displayForecast();
    deskletObj.displayMeta();
  },

  mockData: function() {
    this.data.city = 'Foo';
    this.data.country = 'Bar';
    this.data.days=[];
    this.data.cc = new Object();
    this.data.cc.wind_direction = 'SW';
    this.data.cc.wind_speed = '6';
    this.data.cc.pressure = '990';
    this.data.cc.pressure_direction = 'Rising';
    this.data.cc.temperature = '3';
    this.data.cc.humidity = '55';
    this.data.cc.visibility = '';
    this.data.cc.obstime = '';
    this.data.cc.weathertext = 'Sunny';
    this.data.cc.weathericon = '';
    var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    for(let i=0; i<this.maxDays; i++) {
      let day = new Object();
      day.day = days[i +2];
      day.weathertext = 'Clouds';
      day.icon = i+10;
      day.maximum_temperature ='99';
      day.minimum_temperature = '-33';
      day.wind_direction = 'N';
      day.wind_speed = '1';
      day.visibility = '';
      day.pressure = '';
      day.humidity = '';
      day.uv_risk = '';
      day.pollution = '';
      day.sunrise = '';
      day.sunset = '';
      this.data.days[i] = day;
    };
  },
};

function main(metadata, desklet_id){
  let desklet = new MyDesklet(metadata,desklet_id);
  return desklet;
};

//#############################
function print_r (obj, t) {

    // define tab spacing
    var tab = t || '';

    // check if it's array
    var isArr = Object.prototype.toString.call(obj) === '[object Array]';
    
    // use {} for object, [] for array
    var str = isArr ? ('Array\n' + tab + '[\n') : ('Object\n' + tab + '{\n');

    // walk through it's properties
    for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
            var val1 = obj[prop];
            var val2 = '';
            var type = Object.prototype.toString.call(val1);
            switch (type) {
                
                // recursive if object/array
                case '[object Array]':
                case '[object Object]':
                    val2 = print_r(val1, (tab + '\t'));
                    break;
                    
                case '[object String]':
                    val2 = '\'' + val1 + '\'';
                    break;
                    
                default:
                    val2 = val1;
            }
            str += tab + '\t' + prop + ' => ' + val2 + ',\n';
        }
    }
    
    // remove extra comma for last property
    str = str.substring(0, str.length - 2) + '\n' + tab;
    
    return isArr ? (str + ']') : (str + '}');
};
