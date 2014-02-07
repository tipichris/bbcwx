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
    this.daynames={Monday: _('Mon'),Tuesday: _('Tue'), Wednesday: _('Wed'), Thursday: _('Thu'), Friday: _('Fri'), Saturday: _('Sat'), Sunday: _('Sun')};
    this.fwicons=[];this.labels=[];this.max=[];this.min=[];this.windd=[];this.winds=[];this.tempn=[];this.eachday=[];this.wxtooltip=[];
    this.cc=[];this.days=[];
    this.metadata = metadata;
    this.proces=null;
    this.windowcreated=false;
    this.no=3; // number of days to show
    this.creditlink='www.bbc.co.uk/weather';
        
    //################################

    try {
      Desklet.Desklet.prototype._init.call(this, metadata);
      //#########################binding configuration file################
      this.settings = new Settings.DeskletSettings(this, UUID, this.desklet_id);                    
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"stationID","stationID",this._refreshweathers,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"units","units",this._refreshweathers,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"wunits","wunits",this._refreshweathers,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"transparency","transparency",this._refreshweathers,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"textcolor","textcolor",this._refreshweathers,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"bgcolor","bgcolor",this._refreshweathers,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"zoom","zoom",this._refreshweathers,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"border","border",this._refreshweathers,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"bordercolor","bordercolor",this._refreshweathers,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"layout","layout",this._refreshweathers,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"iconstyle","iconstyle",this._refreshweathers,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"citystyle","citystyle",this._refreshweathers,null);


      this.helpFile = DESKLET_DIR + "/help.html"; 
      this._menu.addAction(_("Help"), Lang.bind(this, function() {
        Util.spawnCommandLine("xdg-open " + this.helpFile);
      }));

           
      this.proces=true;
    
      this._refreshweathers();
      
    }
    catch (e) {
      global.logError(e);
    }
    return true;
  },

  //##########################REFRESH#########################  
  
  style_change: function() {
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

    for(f=0;f<this.no;f++) {
      this.labels[f].style='text-align : center;font-size: '+TEXT_SIZE*this.zoom+"px";
      this.fwicons[f].height=ICON_HEIGHT*this.zoom;this.fwicons[f].width= ICON_WIDTH*this.zoom;
      this.max[f].style= 'text-align : center; font-size: '+TEXT_SIZE*this.zoom+"px";
      this.min[f].style= 'text-align : center; font-size: '+TEXT_SIZE*this.zoom+"px";
      this.winds[f].style= 'text-align : center; font-size: '+TEXT_SIZE*this.zoom+"px";
     this.windd[f].style= 'text-align : center; font-size: '+TEXT_SIZE*this.zoom+"px";
    }
    
    this.buttons.style="padding-top:"+BUTTON_PADDING*this.zoom+"px;padding-bottom:"+BUTTON_PADDING*this.zoom+"px";
    
    this.iconbutton.icon_size=REFRESH_ICON_SIZE*this.zoom;
    this.banner.style='font-size: '+LINK_TEXT_SIZE*this.zoom+"px; color: " + this.textcolor;
    this.bannerpre.style='font-size: '+LINK_TEXT_SIZE*this.zoom+"px; color: " + this.textcolor; 
    
    this.maxlabel.style = 'text-align : right;font-size: '+LABEL_TEXT_SIZE*this.zoom+"px";
    this.minlabel.style = 'text-align : right;font-size: '+LABEL_TEXT_SIZE*this.zoom+"px";
    this.windlabel.style = 'text-align : right;font-size: '+LABEL_TEXT_SIZE*this.zoom+"px";
    this.winddlabel.style = 'text-align : right;font-size: '+LABEL_TEXT_SIZE*this.zoom+"px";
    
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
    this._separatorArea = new St.DrawingArea({ style_class: STYLE_POPUP_SEPARATOR_MENU_ITEM });
    
    // current weather values
    this.humidity=new St.Label();
    this.pressure=new St.Label();
    this.windspeed=new St.Label();
    
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
    this.container= new St.BoxLayout({vertical: true, x_align: St.Align.MIDDLE, style: "padding-left: 5px;"});//definire coloana dreapta
    // container for left (horizontal) or upper (vertical) part of window
    this.cweather = new St.BoxLayout({vertical: true}); //definire coloana stangz
    // current weather icon container
    this.cwicon = new St.Bin({height: (CC_ICON_HEIGHT*this.zoom), width: (CC_ICON_WIDTH*this.zoom)}); //icoana mare cu starea vremii
    // current weather text
    this.weathertext=new St.Label({style: 'text-align : center; font-size:'+CC_TEXT_SIZE*this.zoom+'px'}); //-textul cu starea vremii de sub ditamai icoana :)
    
    this.city.add_actor(this.cityname); 

    this.ctemp_captions.add_actor(new St.Label({text: _('Humidity: ')}));
    this.ctemp_captions.add_actor(new St.Label({text: _('Pressure: ')}));
    this.ctemp_captions.add_actor(new St.Label({text: _('Wind: ')}));
    this.ctemp_values.add_actor(this.humidity);
    this.ctemp_values.add_actor(this.pressure);
    this.ctemp_values.add_actor(this.windspeed);
    this.ctemp.add_actor(this.ctemp_captions); //-adauga coloana din stanga la informatii
    this.ctemp.add_actor(this.ctemp_values);  //adauga coloana din dreapta la informatii     
    
    // build table to hold three day forecast
    this.fwtable =new St.Table({style: "spacing-rows: "+TABLE_ROW_SPACING*this.zoom+"px;spacing-columns: "+TABLE_COL_SPACING*this.zoom+"px;padding: "+TABLE_PADDING*this.zoom+"px;"});
    this.maxlabel = new St.Label({text: _('Max:'), style: 'text-align : right;font-size: '+LABEL_TEXT_SIZE*this.zoom+"px"});
    this.minlabel = new St.Label({text: _('Min:'), style: 'text-align : right;font-size: '+LABEL_TEXT_SIZE*this.zoom+"px"})
    this.windlabel = new St.Label({text: _('Wind:'), style: 'text-align : right;font-size: '+LABEL_TEXT_SIZE*this.zoom+"px"})
    this.winddlabel = new St.Label({text: _('Dir:'), style: 'text-align : right;font-size: '+LABEL_TEXT_SIZE*this.zoom+"px"})
    this.fwtable.add(this.maxlabel,{row:2,col:0});
    this.fwtable.add(this.minlabel,{row:3,col:0});
    this.fwtable.add(this.windlabel,{row:4,col:0});
    this.fwtable.add(this.winddlabel,{row:5,col:0}); 
    for(f=0;f<this.no;f++) {
      this.labels[f]=new St.Button({label: '', style: 'color: ' + this.textcolor + ';text-align: center;font-size: '+TEXT_SIZE*this.zoom+"px" });
      this.fwicons[f]=new St.Button({height:ICON_HEIGHT*this.zoom, width: ICON_WIDTH*this.zoom});
      this.max[f]=new St.Label({style: 'text-align : center;font-size: '+TEXT_SIZE*this.zoom+"px"});
      this.min[f]=new St.Label({style: 'text-align : center;font-size: '+TEXT_SIZE*this.zoom+"px"});
      this.winds[f]=new St.Label({style: 'text-align : center;font-size: '+TEXT_SIZE*this.zoom+"px"});
      this.windd[f]=new St.Label({style: 'text-align : center;font-size: '+TEXT_SIZE*this.zoom+"px"});
      this.wxtooltip[f] = new Tooltips.Tooltip(this.fwicons[f]);
      
      this.fwtable.add(this.labels[f],{row:0,col:f+1});
      this.fwtable.add(this.fwicons[f],{row:1,col:f+1});
      this.fwtable.add(this.max[f],{row:2,col:f+1});
      this.fwtable.add(this.min[f],{row:3,col:f+1});
      this.fwtable.add(this.winds[f],{row:4,col:f+1});
      this.fwtable.add(this.windd[f],{row:5,col:f+1});
    }
    
    this.but.set_child(this.iconbutton);
    this.but.connect('clicked', Lang.bind(this, this._refreshweathers));
    // seems we have to use a button for bannerpre to get the vertical alignment :(
    this.bannerpre=new St.Button({label: _('Data from '), style: 'font-size: '+LINK_TEXT_SIZE*this.zoom+"px; color: " + this.textcolor + ";"});
    this.banner=new St.Button({label: this.creditlink, 
      style: 'font-size: '+LINK_TEXT_SIZE*this.zoom+"px; color: " + this.textcolor + ";",
      reactive: true,
      track_hover: true,
      style_class: 'bbcwx-link'});
    this.banner.connect('clicked', Lang.bind(this, function() {
        Util.spawnCommandLine("xdg-open http://" + this.creditlink + '/' + this.stationID);
      }));
    this.bannertooltip = new Tooltips.Tooltip(this.banner, _('Click to visit the BBC weather website'));
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
  
  _refreshweathers: function() {
    //global.log('Entering _refreshweathers');
    if (this.proces) {
      let now=new Date().toLocaleFormat('%H:%M:%S');
      global.log("bbcwx (instance " + this.desklet_id + "): refreshing forecast at " + now);
      if(!this.windowcreated) {
        this.createwindow(); 
        this.windowcreated=true;
      }
      this.style_change();
      this.setContent(this.window);
      
      // process the three day forecast
      let a = this.getWeather('3dayforecast', function(weather) {
        if (weather) {
          this.days=this.load_days(weather);
        }  else {
          this.days['city']=_('No data available');
        }
        this.cityname.text=this.days['city'];
        for(f=0;f<this.no;f++)
        {
          this.labels[f].label=this.daynames[this.days[f]['day']];
          let fwiconimage = this._getIconImage(this.days[f]['weathertext']);
          fwiconimage.set_size(ICON_WIDTH*this.zoom, ICON_HEIGHT*this.zoom);
          this.fwicons[f].set_child(fwiconimage);      
          this.wxtooltip[f].set_text(_(this.days[f]['weathertext']));
          this.max[f].text=this._formatTemerature(this.days[f]['maximum_temperature'], true);
          this.min[f].text=this._formatTemerature(this.days[f]['minimum_temperature'], true);
          this.winds[f].text=this._formatWindspeed(this.days[f]['wind_speed'], true);
          this.windd[f].text= _(this.days[f]['wind_direction']);
        }
      });

      // process current observations
      let b = this.getWeather('observations', function(weather) {
        if (weather) {
          this.cc=this.set_vars(weather); 
        } else {
          this.cc['weathertext']=_('No data available');
        }
        let cwimage=this._getIconImage(this.cc['weathertext']);
        cwimage.set_size(CC_ICON_WIDTH*this.zoom, CC_ICON_HEIGHT*this.zoom);
        this.cwicon.set_child(cwimage);
        this.weathertext.text=_(this.cc['weathertext']) + ', ' + this._formatTemerature(this.cc['temperature'], true);
        this.humidity.text= this.cc['humidity'];
        this.pressure.text=this.cc['pressure'];
        this.windspeed.text=_(this.cc['wind_direction']) + ", " + this._formatWindspeed(this.cc['wind_speed'], true);
      });
      
      if(this._timeoutId != undefined) {
        Mainloop.source_remove(this._timeoutId);
      }
      
      this._timeoutId=Mainloop.timeout_add_seconds(600 + Math.round(Math.random()*120), Lang.bind(this, this._refreshweathers));
    }
  },

  _getIconImage: function(wxtext) {
    let icon_name = 'na.svg';
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
    let icon_ext = '.png';
    wxtext = wxtext.toLowerCase();
    //global.log('wxtext: ' + wxtext);
    if (typeof iconmap[wxtext] !== "undefined") {
      icon_name = iconmap[wxtext];
    }
      
    let icon_file = DESKLET_DIR + '/icons/' + this.iconstyle +'/' + icon_name + icon_ext;
    let file = Gio.file_new_for_path(icon_file);
    let icon_uri = file.get_uri();
    
    return St.TextureCache.get_default().load_uri_async(icon_uri, 200*this.zoom, 200*this.zoom);
  },
  
  // take a string with both C and F and extract the required 
  // value. Append unit string if units is true
  _formatTemerature: function(temp, units) {
    units = typeof units !== 'undefined' ? units : false;
    if (!temp) return '';
    let celsius = temp.slice(0, temp.indexOf('C')-1).trim();
    let fahr = temp.slice(temp.indexOf('(')+1, temp.length - 3).trim();
    let out = ((this.units==1) ? celsius : fahr);
    if (units) {
      out += ((this.units==1) ? _("\u2103") : _("\u2109"))
    }
    return out;
  },

  // take a string with speed in mph and convert to required 
  // units. Append unit string if units is true
  _formatWindspeed: function(wind, units) {
    units = typeof units !== 'undefined' ? units : false;
    if (!wind) return '';
    let conversion = {
      'mph': 1,
      'knots': 0.869,
      'kph': 1.6,
      'mps': 0.447
    };
    let unitstring = {
      'mph': _('mph'),
      'knots': _('kts'),
      'kph': _('km/h'),
      'mps': _('m/s')
    }
    let mph = wind.replace('mph', '');
    let out = mph * conversion[this.wunits];
    out = out.toFixed(0);
    if (units) {
      out += unitstring[this.wunits];
    }
    return out;
  },
    
  // take an rss feed of current observations and extract data into an array
  set_vars: function (rss) {
    let parser = new marknote.Parser();
    let doc = parser.parse(rss);
    let rootElem = doc.getRootElement();
    let channel = rootElem.getChildElement("channel");
    let item = channel.getChildElement("item");
    let desc = item.getChildElement("description").getText();
    let title = item.getChildElement("title").getText();
    desc = desc.replace('mb,', 'mb|');
    parts
    let cc=[];
    cc['weathertext'] = title.split(':')[2].split(',')[0].trim();
    let parts = desc.split(',');
    let k, v;
    for (let b=0; b<parts.length; b++) {
      k = parts[b].slice(0, parts[b].indexOf(':')).trim().replace(' ', '_').toLowerCase();
      v = parts[b].slice(parts[b].indexOf(':')+1).trim();
      if (k == "wind_direction") {
        let vparts = v.split(" ");
        v = '';
        for (let c=0; c<vparts.length; c++) {
          v += vparts[c].charAt(0).toUpperCase();
        }
      }
      if (k == "pressure") {
        v=v.replace('|', ',');
      }      
      cc[k] = v;
    }   
    
    return cc;
  },
  
  // take an rss feed of 3 day forecast and extract data into an array
  load_days: function (rss) {
    //global.log('entering load_days');
    let days = [];
    
    let parser = new marknote.Parser();
    let doc = parser.parse(rss);

    let rootElem = doc.getRootElement();
    let channel = rootElem.getChildElement("channel");
    days['city'] = channel.getChildElement("title").getText().split("Forecast for")[1].trim();
    //global.log('City: ' + days['city']);
    let items = channel.getChildElements("item");
    let desc, title;

    let data = [];
    for (let i=0; i<items.length; i++) {
      desc = items[i].getChildElement("description").getText();
      title = items[i].getChildElement("title").getText();
      data['link'] = items[i].getChildElement("link").getText();
      //global.log('Link: ' + data['link']);
      data['day'] = title.split(':')[0].trim();
      data['weathertext'] = title.split(':')[1].split(',')[0].trim();
      let parts = desc.split(',');
      let k, v;
      for (let b=0; b<parts.length; b++) {
        k = parts[b].slice(0, parts[b].indexOf(':')).trim().replace(' ', '_').toLowerCase();
        v = parts[b].slice(parts[b].indexOf(':')+1).trim();
        if (k == "wind_direction") {
          let vparts = v.split(" ");
          v = '';
          for (let c=0; c<vparts.length; c++) {
            v += vparts[c].charAt(0).toUpperCase();
          }
        }
        data[k] = v;
      }
      days[i] = data;
      data = [];
    }
    //global.log('returning from load_days');
    return days;
  },
  
  // async call to retrieve rss feed. 
  // -> type: either '3dayforecast' or 'observations'
  getWeather: function(type, callback) {
    //global.log("Called getWeather with type " + type);
    let here = this;
    let url = 'http://open.live.bbc.co.uk/weather/feeds/en/' + this.stationID +'/' + type + '.rss';
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

  
  on_desklet_removed: function() {
    if(this._timeoutId != undefined)
      {Mainloop.source_remove(this._timeoutId);}
    }
}

function main(metadata, desklet_id){
  let desklet = new MyDesklet(metadata,desklet_id);
  return desklet;
}
