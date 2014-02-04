//Hope you like it.i've done this mostly for myself
//Unfortunately i dont have an accuweather api key to get more info from it.


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

imports.searchPath.push(GLib.get_home_dir()+'/.local/share/cinnamon/desklets/bbcwx@oak-wood.co.uk/');
const xml = imports.marknote;

const text_aliniere= 'text-align : center';
var counter=0;var cc;//var docu;//var mesaj;
const STYLE_POPUP_SEPARATOR_MENU_ITEM = 'popup-separator-menu-item';
const STYLE_FORECAST = 'forecast';

const _httpSession = new Soup.SessionAsync();
Soup.Session.prototype.add_feature.call(_httpSession, new Soup.ProxyResolverDefault());


function MyDesklet(metadata,decklet_id){
  this._init(metadata,decklet_id);
}

MyDesklet.prototype = {
  __proto__: Desklet.Desklet.prototype,
    

  _init: function(metadata,decklet_id){
    //############Variables###########
    this.switch="day";this.daynames={Monday: 'Mo',Tuesday:'Tu', Wednesday:'We', Thursday:'Th', Friday:'Fr', Saturday:'Sa', Sunday:'Su'};
    this.fwicons=[];this.labels=[];this.tempd=[];this.windd=[];this.winds=[];this.tempn=[];this.eachday=[];
    this.switch="daytime"
    this.cc=[];this.days=[];
    this.icon_paths = GLib.get_home_dir()+'/.local/share/cinnamon/desklets/bbcwx@oak-wood.co.uk/icons/';
    this.metadata = metadata
    this.update_id = null;
    this.proces=null;
    this.test=0;
    this.no=4;
    this.bbcicons = {
      'clear sky' : '0.png', //night
      'sunny' : '1.png',
      'partly cloudy' : '2.png',  //night
      'sunny intervals' : '3.png',
      'sand storm' : '4.png', // not confirmed
      'mist' : '5.png',
      'fog' : '6.png',
      'white cloud' : '7.png',
      'light cloud' : '7.png',
      'grey cloud' : '8.png',
      'thick cloud' : '8.png',
      // light rain shower night 9
      'light rain shower' : '10.png',
      'drizzle' : '11.png',
      'light rain' : '12.png',
      // heavy rain shower night 13
      'heavy rain shower' : '14.png',
      'heavy rain' : '15.png',
      // sleet shower night 16
      'sleet shower' : '17.png',
      'sleet' : '18.png',
      // 19, 20, 21 ???
      // light snow shower night 22
      'light snow shower' : '23.png',
      'light snow' : '24.png',
      // heavy snow shower night 25
      'heavy snow shower' : '26.png',
      'heavy snow' : '27.png',
      // thundery shower night 28
      'thundery shower' : '29.png',
      'thunder storm' : '30.png',
      'thunderstorm' : '30.png',
      'hazy' : '32.png', //not confirmed
    };
    
    this.icons = {
      'clear sky' : '33.PNG', //night
      'sunny' : '01.PNG',
      'partly cloudy' : '38.PNG',  //night
      'sunny intervals' : '04.PNG',
      'mist' : '11.PNG',
      'fog' : '11.PNG',
      'white cloud' : '07.PNG',
      'light cloud' : '07.PNG',
      'grey cloud' : '08.PNG',
      'thick cloud' : '08.PNG',
      'light rain shower' : '16.PNG',
      'drizzle' : '12.PNG',
      'light rain' : '12.PNG',
      'heavy rain shower' : '16.PNG',
      'heavy rain' : '13.PNG',
      'sleet shower' : '24.PNG',
      'sleet' : '25.PNG',     
      'light snow shower' : '21.PNG',
      'light snow' : '19.PNG',
      'heavy snow shower' : '23.PNG',
      'heavy snow' : '22.PNG',
      'thundery shower' : '17.PNG',
      'thunder storm' : '15.PNG',
      'thunderstorm' : '15.PNG',
      'hazy' : '32.PNG', //not confirmed
    };
    
    //################################

    try {
      Desklet.Desklet.prototype._init.call(this, metadata);
      //#########################binding configuration file################
      this.settings = new Settings.DeskletSettings(this, "bbcwx@oak-wood.co.uk", this.desklet_id);                    
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"stationID","stationID",this._refreshweathers,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"units","units",this._refreshweathers,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"wunits","wunits",this._refreshweathers,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"transparency","transparency",this._refreshweathers,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"textcolor","textcolor",this._refreshweathers,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"bgcolor","bgcolor",this._refreshweathers,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"zoom","zoom",this._refreshweathers,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"border","border",this._refreshweathers,null);
      this.settings.bindProperty(Settings.BindingDirection.ONE_WAY,"bordercolor","bordercolor",this._refreshweathers,null);

            
      this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      this._menu.addAction(_("Settings"), Lang.bind(this, function() {
        Util.spawnCommandLine("cinnamon-settings desklets bbcwx@oak-wood.co.uk")  
      }));

      this.helpFile = GLib.get_home_dir() + "/.local/share/cinnamon/desklets/bbcwx@oak-wood.co.uk/README";  
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
    this.cwicon.height=170*this.zoom;this.cwicon.width=200*this.zoom;
    this.weathertext.style= 'text-align : center; font-size:'+30*this.zoom+'px';
    this.table.style="spacing-rows: "+5*this.zoom+"px;spacing-columns: "+5*this.zoom+"px;padding: "+10*this.zoom+"px;";
    this.cityname.style="text-align: center;font-size: "+14*this.zoom+"px" ;    
    this.ctemp_captions.style = 'text-align : right;font-size: '+14*this.zoom+"px";
    this.ctemp_values.style = 'text-align : left; font-size: '+14*this.zoom+"px";
    // this._separatorArea.width = 200*this.zoom;
    if (this.border) {
      this.window.style="border: 2px solid "+this.bordercolor+"; border-radius: 12px; padding: 5px; background-color: "+(this.bgcolor.replace(")",","+this.transparency+")")).replace('rgb','rgba')+"; color: "+this.textcolor;
    }
    else {
      this.window.style="border-radius: 12px; padding: 5px; background-color: "+(this.bgcolor.replace(")",","+this.transparency+")")).replace('rgb','rgba')+"; color: "+this.textcolor;
    }
    this._separatorArea.height=5*this.zoom;
    this.temperature.style="font-size:"+14*this.zoom+"px;text-align:left";

      
    for(f=1;f<this.no;f++) {
      this.labels[f].style='text-align : center;font-size: '+14*this.zoom+"px";
      this.fwicons[f].height=50*this.zoom;this.fwicons[f].width= 60*this.zoom;
      this.tempd[f].style= 'text-align : center;padding: 0 3px; font-size: '+14*this.zoom+"px";
      this.winds[f].style= 'text-align : center;padding: 0 3px;font-size: '+14*this.zoom+"px";
      this.windd[f].style= 'text-align : center;padding: 0 3px;font-size: '+14*this.zoom+"px";
    }
    
    this.buttons.style="padding-top:"+3*this.zoom+"px;padding-bottom:"+3*this.zoom+"px";
    
    this.iconbutton.icon_size=20*this.zoom;
    this.banner.style='font-size: '+14*this.zoom+"px"; 
  },
  
  createwindow: function(){
    this.window=new St.BoxLayout({vertical: false});
   
    this.buttons=new St.BoxLayout({vertical: false,style: "padding-top:"+3*this.zoom+"px;padding-bottom:"+3*this.zoom+"px",x_align:2});
    this.iconbutton=new St.Icon({ icon_name: 'weather-clear-symbolic',
      icon_size: 20*this.zoom+'',
      icon_type: St.IconType.SYMBOLIC});
    this.but=new St.Button();
    this.labels=[]; this.fwicons=[];this.tempd=[]; this.windd=[]; this.winds=[]; this.eachday=[];
    this._forecasticons = new St.BoxLayout({vertical: false,x_align:2}); //---zii/iconita/temperaturi
    this._separatorArea = new St.DrawingArea({ style_class: STYLE_POPUP_SEPARATOR_MENU_ITEM });
    this.temperature = new St.Label();
    //this.feelslike = new St.Label();
    this.humidity=new St.Label();
    this.pressure=new St.Label();
    this.windspeed=new St.Label();
    this.ctemp_values = new St.BoxLayout({vertical: true, style : 'text-align : left; font-size: '+14*this.zoom+"px"});
    this.ctemp_values = new St.BoxLayout({vertical: true, style : 'text-align : left; font-size: '+14*this.zoom+"px"});
    this.ctemp_captions = new St.BoxLayout({vertical: true,style : 'text-align : right'});
    this.ctemp = new St.BoxLayout({vertical: false,x_align: 2});
    this.cityname=new St.Label({style: "text-align: center;font-size: "+14*this.zoom+"px" });
    this.city=new St.BoxLayout({vertical:true,style: "align: center;"});
    this.table=new St.Table({style: "spacing-rows: "+5*this.zoom+"px;spacing-columns: "+5*this.zoom+"px;padding: "+10*this.zoom+"px;"});
    this.container= new St.BoxLayout({vertical: true, x_align: St.Align.MIDDLE});//definire coloana dreapta
    this.cweather = new St.BoxLayout({vertical: true}); //definire coloana stangz
    this.cwicon = new St.Bin({height: (170*this.zoom), width: (200*this.zoom)}); //icoana mare cu starea vremii
    this.weathertext=new St.Label({style: 'text-align : center; font-size:'+30*this.zoom+'px'}); //-textul cu starea vremii de sub ditamai icoana :)
    
    this.cweather.add_actor(this.cwicon); //--adauga icoana
    this.cweather.add_actor(this.weathertext); //-adauga textul
    this.city.add_actor(this.cityname); //-------------
    this.ctemp_captions.add_actor(new St.Label({text: _('Temperature: ')}));  
    //this.ctemp_captions.add_actor(new St.Label({text: _('Feels like: ')}));
    this.ctemp_captions.add_actor(new St.Label({text: _('Humidity: ')}));
    this.ctemp_captions.add_actor(new St.Label({text: _('Pressure: ')}));
    this.ctemp_captions.add_actor(new St.Label({text: _('Wind: ')}));
    this.ctemp_values.add_actor(this.temperature); //###adauga valori in coloana din dreapta a informatiilor despre temperatura 
    //this.ctemp_values.add_actor(this.feelslike);
    this.ctemp_values.add_actor(this.humidity);
    this.ctemp_values.add_actor(this.pressure);
    this.ctemp_values.add_actor(this.windspeed);
    this.ctemp.add_actor(this.ctemp_captions); //-adauga coloana din stanga la informatii
    this.ctemp.add_actor(this.ctemp_values);  //adauga coloana din dreapta la informatii     
    for(f=1;f<this.no;f++) {
      this.labels[f]=new St.Label({style: 'text-align : center;font-size: '+14*this.zoom+"px"});
      this.fwicons[f]=new St.Bin({height:50*this.zoom, width: 60*this.zoom});
      //this.fwicons[f].set_child(this._getIconImage(days[f]['weathericon']));
      this.tempd[f]=new St.Label({style: 'text-align : center;padding: 0 3px;font-size: '+14*this.zoom+"px"});
      this.winds[f]=new St.Label({style: 'text-align : center;padding: 0 3px;font-size: '+14*this.zoom+"px"});
      this.windd[f]=new St.Label({style: 'text-align : center;padding: 0 3px;font-size: '+14*this.zoom+"px"});
      this.eachday[f]=new St.BoxLayout({vertical: true });
      this.eachday[f].add_actor(this.labels[f]);
      this.eachday[f].add_actor(this.fwicons[f]);
      this.eachday[f].add_actor(this.tempd[f]);
      this.eachday[f].add_actor(this.winds[f]);
      this.eachday[f].add_actor(this.windd[f]);
      this._forecasticons.add_actor(this.eachday[f]);          
    }
    this.but.set_child(this.iconbutton);
    this.but.connect('clicked', Lang.bind(this, this.forecastchange));
    this.banner=new St.Label({text: _('      bbc.co.uk'),style: 'font-size: '+14*this.zoom+"px"});
    this.buttons.add_actor(this.but);
    this.buttons.add_actor(this.banner);
    if(this.no==6)  {
      this.container.add_actor(this.table);     
    }
    else {
      this.city.style = "padding:"+10*this.zoom+"px";
      this.container.add_actor(this.city); //--adauga label cu orasul
      this.container.add_actor(this.ctemp);//-- adauga tabelul cu informatiile depsre vreme     
    }
    this.container.add_actor(this._separatorArea);//--adauga separatorul
    this.container.add_actor(this._forecasticons); //--adauga zii/iconite/temperaturi
    this.container.add_actor(this.buttons); //adauga butonul de jos si probabil si un banner cu accuweather
    this.window.add_actor(this.cweather);
    this.window.add_actor(this.container);
    
  },
  
  _refreshweathers: function() {
    global.log('Entering _refreshweathers');
    if (this.proces) {
      if(this.test!=this.no) {
        this.test=this.no;
        this.createwindow(); 
      }
      this.style_change();
      this.setContent(this.window);
    
    
      let a = this.getWeather('3dayforecast', function(weather) {
        counter=new Date().toLocaleFormat('%H%M');
        this.days=this.load_days(weather);
        this.cityname.text=this.days['city'];
        for(f=1;f<this.no;f++)
        {
          this.labels[f].text=this.days[f]['day'].substr(0,3);
          //this.fwicons[f]=new St.Bin({height:50, width: 60});
          global.log(this.days[f]['day'] + ": " + this.days[f]['weathertext']);
          this.fwicons[f].set_child(this._getIconImage(this.days[f]['weathertext']));
          this.tempd[f].text=this._formatTemerature(this.days[f]['minimum_temperature'])+" - "+this._formatTemerature(this.days[f]['maximum_temperature']);
          this.winds[f].text=this._formatWindspeed(this.days[f]['wind_speed'], true);
          this.windd[f].text= this.days[f]['wind_direction'];
        }
      });

    
      let b = this.getWeather('observations', function(weather) {
        this.cc=this.set_vars(weather); 
        this.cwicon.set_child(this._getIconImage(this.cc['weathertext'])); //--refresh
        this.weathertext.text=this.cc['weathertext'];
        this.temperature.text = this._formatTemerature(this.cc['temperature'], true);
        //this.feelslike.text=this.cc['realfeel']+((this.units==1) ? " \u2103" : " F");
        this.humidity.text= this.cc['humidity'];
        this.pressure.text=this.cc['pressure'];
        //let wd=this.cc['winddirection'];(wd.length>2)? wd=wd.replace(wd[0]+wd[1],wd[0]+'-'+wd[1]):wd;
        this.windspeed.text=this.cc['wind_direction']+ ", " + this._formatWindspeed(this.cc['wind_speed'], true);
      });
    
      this._timeoutId=Mainloop.timeout_add_seconds(600 + Math.round(Math.random()*120), Lang.bind(this, this._refreshweathers));
    }
  },
    
  _getIconImage: function(wxtext) {
    var icon_name = 'DUNNO.PNG';
    wxtext = wxtext.toLowerCase();
    //global.log('wxtext: ' + wxtext);
    if (typeof this.icons[wxtext] !== "undefined") {
      icon_name = this.icons[wxtext];
    }
      
    let icon_file = this.icon_paths + icon_name;
    let file = Gio.file_new_for_path(icon_file);
    let icon_uri = file.get_uri();

    return St.TextureCache.get_default().load_uri_async(icon_uri, 200*this.zoom, 200*this.zoom);
  },
  
  _formatTemerature: function(temp, units) {
    if (!temp) return '';
    var celsius = temp.slice(0, temp.indexOf('C')-1).trim();
    var fahr = temp.slice(temp.indexOf('(')+1, temp.length - 3).trim();
    var out = ((this.units==1) ? celsius : fahr);
    if (units) {
      out += ((this.units==1) ? "\u2103" : "\u2109")
    }
    return out;
  },

  _formatWindspeed: function(wind, units) {
    if (!wind) return '';
    var conversion = {
      'mph': 1,
      'knots': 0.869,
      'kph': 1.6,
      'mps': 0.447
    };
    var unitstring = {
      'mph': 'mph',
      'knots': 'kts',
      'kph': 'km/h',
      'mps': 'm/s'
    }
    var mph = wind.replace('mph', '');
    var out = mph * conversion[this.wunits];
    out = out.toFixed(0);
    if (units) {
      out += unitstring[this.wunits];
    }
    return out;
  },
    
  set_vars: function (rss) {
    var parser = new marknote.Parser();
    var doc = parser.parse(rss);
    var rootElem = doc.getRootElement();
    var channel = rootElem.getChildElement("channel");
    var item = channel.getChildElement("item");
    var desc = item.getChildElement("description").getText();
    var title = item.getChildElement("title").getText();
    desc = desc.replace('mb,', 'mb|');
    parts
    var cc=[];
    cc['weathertext'] = title.split(':')[2].split(',')[0].trim();
    var parts = desc.split(',');
    var k, v;
    for (var b=0; b<parts.length; b++) {
      k = parts[b].slice(0, parts[b].indexOf(':')).trim().replace(' ', '_').toLowerCase();
      v = parts[b].slice(parts[b].indexOf(':')+1).trim();
      if (k == "wind_direction") {
        var vparts = v.split(" ");
        v = '';
        for (var c=0; c<vparts.length; c++) {
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
  
  load_days: function (rss) {
    var days = [];
    
    var parser = new marknote.Parser();
    var doc = parser.parse(rss);

    var rootElem = doc.getRootElement();
    var channel = rootElem.getChildElement("channel");
//  var title = channel.getChildElements("title").getText();
    days['city'] = channel.getChildElement("title").getText().split("Forecast for")[1].trim();

    var items = channel.getChildElements("item");
    var desc, title;

    var data = [];
    for (var i=0; i<items.length; i++) {
      desc = items[i].getChildElement("description").getText();
      title = items[i].getChildElement("title").getText();
      data['day'] = title.split(':')[0].trim();
      data['weathertext'] = title.split(':')[1].split(',')[0].trim();
      var parts = desc.split(',');
      var k, v;
      for (var b=0; b<parts.length; b++) {
        k = parts[b].slice(0, parts[b].indexOf(':')).trim().replace(' ', '_').toLowerCase();
        v = parts[b].slice(parts[b].indexOf(':')+1).trim();
        if (k == "wind_direction") {
          var vparts = v.split(" ");
          v = '';
          for (var c=0; c<vparts.length; c++) {
            v += vparts[c].charAt(0).toUpperCase();
          }
        }
        data[k] = v;
      }
      days[i+1] = data;
      data = [];
    }
    global.log('returning from load_days');
    return days;
  },
  


//    getWeather: function() {
//   let url = 'http://thale.accu-weather.com/widget/thale/weather-data.asp?location='+this.stationID+'&metric='+this.units+'&format=json'+counter+'';
// //  let url = 'http://localhost/weather.xml';
//   let file = Gio.file_new_for_uri(url).load_contents(null);
//   let doc=(file[1]+"")//.replace(/^<\?xml\s+version\s*=\s*(["'])[^\1]+\1[^?]*\?>/, "");
//   return doc;
//   
//       },
  
  getWeather: function(type, callback) {
    let here = this;
    let url = 'http://open.live.bbc.co.uk/weather/feeds/en/' + this.stationID +'/' + type + '.rss';
    let message = Soup.Message.new('GET', url);
    _httpSession.queue_message(message, function (session, message) {
      let mes = message.response_body.data;
      callback.call(here,mes.toString());      
    });
  }, 
    
       
  forecastchange: function() {
    if(this.switch=='daytime') {
      this.switch='nighttime';   
    } 
    else {
      this.switch='daytime';
    }
    this._refreshweathers();  
  },
    


  
  
  on_desklet_removed: function() {
    if(this._timeoutId)
    {Mainloop.source_remove(this._timeoutId);}
  }
}



function main(metadata, decklet_id){
  let desklet = new MyDesklet(metadata,decklet_id);
  return desklet;
}
