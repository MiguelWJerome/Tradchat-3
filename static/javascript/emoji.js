/*** vars ***/
let emoji_json          = false,
window_width        = null,
style_generated     = null,
active_trigger      = null,
active_sel_cb       = null,
cat_waypoints       = {};

const category_icons = {
"smileys--people" : "😀", 
"animals--nature" : "🐇",
"travel--places"  : "🚘",
"activities"      : "⚽",
"objects"         : "🎧",
"symbols"         : "🈶",
"flags"           : "🚩",
};

const def_opts = {
picker_trigger : 
'', // (string) html code injected as picker trigger  

trigger_position : { // (object) defines trigger position relatively to target field
    top : '5px',
    right: '5px',
},
trigger_size : { // (object) defines trigger size
    height : '22px',
    width: '22px',
},
target_r_padding    : 27, // (int) right padding value (in pixels) applied to target field to avoid texts under the trigger
emoji_json_url      : '/static/emoji.json', // (string) emoji JSON url
trigger_title       : 'insert emoji',

labels : [ // (array) option used to translate script texts
    'insert emoji',
    'search emoji',
    '.. no results ..',
],

selection_callback  : null, // function(emoji, target_field) {}, - triggered as soon as an emoji is selected. Passes emoji and target field objects as parameters
};

let pickerQue = []

/*** hide picker cicking outside ***/
document.addEventListener('click', function(e) {
    let picker = document.querySelector("#lc-emoji-picker");
    
    // close if clicked elementis not in the picker
    if(picker && picker.showing && !picker.contains(e.target)) {
        picker.showing = false;
        picker.style.opacity = '0'
        pickerQue.push(picker)
        setTimeout(function(){
            picker = pickerQue.splice(0, 1)[0]
            picker.style.top = '-9999px';
            picker.style.opacity = '1'
            picker.style.transform = 'scale(0.85)'
        }, 100)
        active_trigger = null;
        active_sel_cb = null;
        return true
    }

    if (document.querySelector(emojiPicker.attachTo).contains(e.target))
    {
        picker.showing = true
    }
});

/* hide picker on screen resizing */
window.addEventListener('resize', function(e) {
    let picker = document.querySelector("#lc-emoji-picker");
    
    // close if clicked elementis not in the picker
    if(picker && picker.showing) {
        picker.showing = false;
        picker.style.opacity = '0'
        pickerQue.push(picker)
        setTimeout(function(){
            picker = pickerQue.splice(0, 1)[0]
            picker.style.top = '-9999px';
            picker.style.opacity = '1'
            picker.style.transform = 'scale(0.85)'
        }, 100)
        active_trigger = null;
        active_sel_cb = null;
    }
});


/*** plugin class ***/
window.lc_emoji_picker = function(attachTo, options = {}) {
    this.attachTo = attachTo;
    this.showing = false

    if(!this.attachTo) {
        return console.error('You must provide a valid selector string first argument');
    }


    // override options
    if(typeof(options) !=  'object') {
        return console.error('Options must be an object');    
    }
    options = Object.assign({}, def_opts, options);

    this.active_sel_cb = options.selection_callback; 
    
    /* initialize */
    this.init = function() {
        const $this = this;

        // Generate style
        if(!style_generated) {
            this.generate_style();
            style_generated = true;
        }

        // load emoji json data on page loaded - stop plugin execution until it is loaded
        if(typeof(emoji_json) != 'object') {
            if (document.readyState === 'loading') {
                document.addEventListener("DOMContentLoaded", () => {this.fetch_emoji_data()});
            } else {
                this.fetch_emoji_data();
            }
            return true;
        }
        
        // assign to each target element
        maybe_querySelectorAll(attachTo).forEach(function(el) {
            
            el.onclick = function(e){$this.show_picker(el)}
            
            // do not initialize twice
            if(el.parentNode.classList.length && el.parentNode.classList.contains('lcep-el-wrap')) {
                return;    
            }

            $this.append_emoji_picker();
        });
    };

    this.re_attach = function(attchElement, call_back = this.active_sel_cb)
    {
        document.querySelectorAll(this.attachTo).forEach(function(el) {
            el.onclick = function(e){}
        });
        this.attachTo = attchElement
        document.querySelectorAll(this.attachTo).forEach(function(el) {
            el.onclick = function(e){emojiPicker.show_picker(el)}
        });
        this.active_sel_cb = call_back
    }
    
    /* emoji search - e = event */
    this.emoji_search = function(e) {
        const parent    = e.target.parentNode,
                val       = e.target.value,
                categories= document.querySelectorAll('#lc-emoji-picker .lcep-category'),
                emojis    = document.querySelectorAll('#lc-emoji-picker .lcep-all-categories li');
        
        if(val.length < 2) {
            for(const emoji of emojis) {        
                emoji.classList.remove('lcep-hidden-emoji');
                
                parent.classList.remove('lcep-searching');
            }
        }
        else {
            for(const emoji of emojis) {     
                (emoji.getAttribute('data-name').match(val)) ? emoji.classList.remove('lcep-hidden-emoji') : emoji.classList.add('lcep-hidden-emoji');        
            }   
            
            parent.classList.add('lcep-searching');
        }  
        
        
        for(const cat of categories) {
            (cat.querySelectorAll('li:not(.lcep-hidden-emoji)').length) ? cat.classList.remove('lcep-hidden-emoji-cat') : cat.classList.add('lcep-hidden-emoji-cat');     
        }

        if(!document.querySelectorAll('.lcep-all-categories ul:not(.lcep-hidden-emoji-cat)').length) {
            if(!document.querySelector('.lcep-no-results')) {
                document.querySelector('.lcep-all-categories').insertAdjacentHTML('beforeend', '<em class="lcep-no-results">'+ options.labels[2] +'</em>');
            }
        } 
        else if(document.querySelector('.lcep-no-results')) {
            document.querySelector('.lcep-no-results').remove();    
        }
    };
    
    
    
    /* clear emoji search */
    this.clear_search = function() {
        const input = document.querySelector('.lcep-search input');

        input.value = '';
        input.dispatchEvent(new Event('keyup'));
    };

    
    
    /* go to emoji category by clicking btn */
    this.go_to_emoji_cat = function(el, cat_id) {
        const top_pos = document.querySelector(".lcep-category[category-name='"+ cat_id +"']").offsetTop;
        document.querySelector('.lcep-all-categories').scrollTop = top_pos - 100;
        
        document.querySelector("li.lcep-active").classList.remove('lcep-active');
        el.classList.add('lcep-active');
    };
    
    
    
    /* select emoji cat on emojis scroll */
    this.cat_waypoints_check = function() {
        const top_scroll = document.querySelector('.lcep-all-categories').scrollTop,
                keys = Object.keys(cat_waypoints);
        
        keys.sort().reverse();
        
        let active = keys[0];
        for(const val of keys) {
            if(top_scroll >= parseInt(val, 10)) {
                active = val;
                break;
            }
        }
        
        const cat_id = cat_waypoints[active];
        
        document.querySelector("li.lcep-active").classList.remove('lcep-active');
        document.querySelector(".lcep-categories li[data-index='"+ cat_id +"']").classList.add('lcep-active');
    };
    
    
    
    /* reset picker: clear search and scrollers */
    this.reset_picker = function() {
        document.querySelector('.lcep-search i').click();
        document.querySelector('.lcep-categories li').click();
    };
    
    
    
    /* show picker */
    /* show picker */
    this.show_picker = function(trigger) {
        let picker = document.getElementById('lc-emoji-picker');
        window_width = window.innerWidth;

        this.reset_picker();
        active_trigger = trigger;
        active_sel_cb = options.selection_callback; 
                     
        const   picker_w    = picker.offsetWidth,
                picker_h    = picker.offsetHeight,
                at_offsety  = active_trigger.getBoundingClientRect(),
                at_h        = active_trigger.offsetHeight,
                y_pos       = (at_offsety.top + at_h + 5);

        // left pos control - using viewport-relative 'left' with centering
        let left = (at_offsety.left + (active_trigger.offsetWidth / 2) - (picker_w / 2));
        
        // checking side overflows with 10px buffer
        if(left < 10) {
            left = 10;
        } else if (left + picker_w > window.innerWidth - 10) {
            left = window.innerWidth - picker_w - 10;
        }
        
        // mobile? show it centered
        if(window.innerWidth < 700) {
            left = Math.floor((window.innerWidth - picker_w) / 2);    
        }
        
        // top or bottom? Logic to flip if it hits the bottom of the screen
        const should_flip = (y_pos + picker_h > window.innerHeight);
        const final_y = should_flip ? (at_offsety.top - picker_h - 5) : y_pos;

        // Apply styles with fixed positioning and high z-index
        picker.style.position = 'fixed';
        picker.style.zIndex = '10001';
        picker.style.top = final_y + 'px';
        picker.style.left = left + 'px';
        picker.style.transform = 'scale(1)';
        picker.style.opacity = '1';
    };
    
    
    
    /* select emoji and insert it in the field */
    this.emoji_select = function(emoji) {
        const true_emoji = (emoji.getElementsByTagName('IMG').length) ? emoji.getElementsByTagName('IMG')[0].getAttribute('alt') : emoji.innerText;     
        
        this.active_sel_cb.call(this, true_emoji);    
        
    };
    
  
    

    /* fetches emoji JSON data */
    this.fetch_emoji_data = function() {
        
        // avoid multiple fetcheings and wait for it
        if(typeof(emoji_json) == 'object') {
            this.init();
            return true;
        }
        if(emoji_json == 'loading') {
            const that = this;
            
            setTimeout(function() {
                that.fetch_emoji_data();
            }, 50);
            
            return true;
        }
        
        emoji_json = 'loading';
        
        fetch(options.emoji_json_url)
            .then(response => response.json())
            .then(object => {
                emoji_json = object;
                this.init();
            })
            .catch(function(err) {
                emoji_json = false;
            });
    };

    
    
    /* append emoji container picker to the body */
    this.append_emoji_picker = function() {

        if(document.getElementById("lc-emoji-picker")) {
            return true;
        }
        
        let picker = `
        <div id="lc-emoji-picker" class="lc-emoji-picker">
            <div class="lcep-categories">%categories%
                <div class="lcep-search">
                    <input placeholder="${ options.labels[1] }" />
                    <svg x="0px" y="0px" viewBox="0 0 512.005 512.005" xml:space="preserve"><g><g><path d="M505.749,475.587l-145.6-145.6c28.203-34.837,45.184-79.104,45.184-127.317c0-111.744-90.923-202.667-202.667-202.667S0,90.925,0,202.669s90.923,202.667,202.667,202.667c48.213,0,92.48-16.981,127.317-45.184l145.6,145.6c4.16,4.16,9.621,6.251,15.083,6.251s10.923-2.091,15.083-6.251C514.091,497.411,514.091,483.928,505.749,475.587z M202.667,362.669c-88.235,0-160-71.765-160-160s71.765-160,160-160s160,71.765,160,160S290.901,362.669,202.667,362.669z"/></g></svg>
                    <i>×</i>
                </div>
            </div>
            <div>%pickerContainer%</div>
        </div>`;

        let categories      = '<ul>%categories%</ul>',
            categoriesInner = ``,
            outerUl         = `<div class="lcep-all-categories">%outerUL%</div>`,
            innerLists      = ``,
            
            index           = 0,
            object          = emoji_json; // Loop through emoji object

        for (const key in object) {
            if (object.hasOwnProperty(key)) {
                
                // Index count
                index++;
                let keyToId = key.split(' ').join('-').split('&').join('').toLowerCase();

                const categories = object[key];
                categoriesInner += `
                <li class="${(index === 1) ? 'lcep-active' : ''}" data-index="${keyToId}" title="${key}">
                    <a href="javascript:void(0)">${category_icons[keyToId]}</a>
                </li>`;

                innerLists += `
                <ul class="lcep-category" category-name="${keyToId}">
                    <div class="lcep-container-title">${key}</div>
                    <div class="lcep-grid">`;

                        // Loop through emoji items
                        categories.forEach(item => {
                            innerLists += `
                            <li data-name="${item.description.toLowerCase()}">
                                <a class="lcep-item" title="${item.description}" data-name="${item.description.toLowerCase()}" data-code="${item.code}" href="javascript:void(0)">${item.emoji}</a>
                            </li>`;
                        });

                    innerLists += `
                    </div>
                </ul>`;
            }
        }
        
        let allSmiles   = outerUl.replace('%outerUL%', innerLists),
            cats        = categories.replace('%categories%', categoriesInner);

        picker = picker.replace('%pickerContainer%', allSmiles).replace('%categories%', cats);
        document.body.insertAdjacentHTML('beforeend', picker);
        
        
        // bind cat naviagation
        for (const cat of document.querySelectorAll('.lcep-categories li')) {
            cat.addEventListener("click", (e) => {
                this.go_to_emoji_cat(cat, cat.getAttribute('data-index'));
            });    
        }
        
        // set save waypoints for scrolling detection
        for (const cat_tit of document.querySelectorAll('.lcep-container-title')) {
            cat_waypoints[ cat_tit.offsetTop - 112 ] = cat_tit.parentNode.getAttribute('category-name');
        }
        
        let scroll_defer = false;
        document.querySelector('.lcep-all-categories').addEventListener("scroll", () => {
            if(scroll_defer) {
                clearTimeout(scroll_defer);     
            }
            scroll_defer = setTimeout(() => {
                this.cat_waypoints_check();
            }, 50);
        });
        
        // bind search
        document.querySelector('.lcep-search i').addEventListener("click", (e) => {this.clear_search()});

        // emoji selection
        for (const emoji of document.querySelectorAll('.lcep-all-categories li')) {
            emoji.addEventListener("click", (e) => {this.emoji_select(emoji)});
        }

        document.querySelector('.lcep-search input').addEventListener("keyup", (e) => {
            this.emoji_search(e)    
        });

        document.querySelector('#lcep-emoji-picker').visible = false    
    };
    
    
    
    /* creates inline CSS into the page */
    this.generate_style = function() {        
        document.head.insertAdjacentHTML('beforeend', 
`<style>
.lcep-el-wrap {
position: relative;
}
.lcep-el-wrap > textarea,
.lcep-el-wrap > input {
padding-right: ${options.target_r_padding}px;
}
.lcep-trigger {
display: inline-block;
position: absolute;
cursor: pointer;
}
.lcep-trigger svg {
width: 100%;
height: 100%;
border-radius: 50%;
border: 2px solid transparent;
opacity: 0.8;
fill: #282828;
transition: all .15s ease;
}
.lcep-trigger svg:hover {
fill: #202020;
}
#lc-emoji-picker,
#lc-emoji-picker * {
box-sizing: border-box;
}
#lc-emoji-picker {
position: fixed;
top: -9999px;
z-index: 9999;
width: 280px;
min-height: 320px;
background: #fff;
box-shadow: 0px 2px 13px -2px rgba(0, 0, 0, 0.18);
border-radius: 6px;
overflow: hidden;
border: 1px solid #ccc;
transform: scale(0.85);
transition: opacity .2s ease, transform .2s ease;
}

#lc-emoji-picker .lcep-all-categories {
height: 260px;
overflow-y: auto;
padding: 0 5px 20px 10px;
}
#lc-emoji-picker .lcep-category:not(:first-child) {
margin-top: 22px;
}
#lc-emoji-picker .lcep-container-title {
color: black;
margin: 10px 0;
text-indent: 10px;
font-size: 13px;
font-weight: bold;
}
#lc-emoji-picker * {
margin: 0;
padding: 0;
text-decoration: none;
color: #666;
font-family: sans-serif;
user-select: none;
-webkit-tap-highlight-color:  rgba(255, 255, 255, 0); 
}
.lcep ul {
list-style: none;
margin: 0;
padding: 0;
}
.lcep-grid {
display: flex;
flex-wrap: wrap;
}
.lcep-grid > li {
cursor: pointer;
flex: 0 0 calc(100% / 6);
max-width: calc(100% / 6);
height: 41px;
min-width: 0;
display: flex;
justify-content: center;
align-items: center;
background: #fff;
border-radius: 2px;
transition: all .2s ease;
}
.lcep-grid > li:hover {
background: #99c9ef;
}
ul.lcep-hidden-emoji-cat,
.lcep-grid > li.lcep-hidden-emoji {
display: none;
}
.lcep-grid > li > a {
display: block;
font-size: 21px;
margin: 0;
padding: 22px 0px;
line-height: 0;
}
.lcep-categories ul {
display: flex;
flex-wrap: wrap;
list-style: none;
}
.lcep-categories li {
transition: all .3s ease;
flex: 0 0 calc(100% / 7);
display: flex;
max-width: calc(100% / 7);
}
.lcep-categories li.lcep-active {
box-shadow: 0 -3px 0 #48a6f0 inset;
}
.lcep-categories a {
padding: 7px !important;
font-size: 19px;
height: 42px;
display: flex;
text-align: center;
justify-content: center;
align-items: center;
position: relative;
filter: grayscale(100%) contrast(150%);
}
.lcep-categories a:before {
content: "";
position: absolute;
top: 0;
left: 0;
right: 0;
bottom: 0;
background: rgba(255, 255, 255, .2);
cursor: pointer;
transition: background .25s ease;
}
.lcep-categories li:not(.lcep-active):hover a:before {
background: rgba(255, 255, 255, .4);
}
.lcep-search {
position: relative;
border-top: 1px solid #ddd;
padding: 10px 6px !important;
}
.lcep-search input {
width: 100%;
border: none;
padding: 8px 30px 8px 10px !important;
outline: none;
background: #fff;
font-size: 13px;
color: #616161;
border: 2px solid #ddd;
height: 30px;
border-radius: 25px; 
user-select: auto !important;
}
.lcep-search svg,
.lcep-search i {
width: 14px;
height: 14px;
position: absolute;
right: 16px;
top: 18px;
fill: #444;
cursor: pointer;
}
.lcep-search i {
color: #444;
font-size: 22px;
font-family: arial;
line-height: 14px;
transition: opacity .15s ease;
}
.lcep-search i:hover {
opacity: .8;
}
.lcep-searching svg,
.lcep-search:not(.lcep-searching) i {
display: none;
}
#lc-emoji-picker img.emoji {
min-width: 23px;
height: auto !important;
}
#lc-emoji-picker .lcep-no-results {
font-size: 90%;
display: block;
text-align: center;
margin-top: 1em;
}
</style>`);
    };
    

    // init when called
    this.init();
};






// UTILITIES

// sanitize "selector" parameter allowing both strings and DOM objects
const maybe_querySelectorAll = (selector) => {
            
    if(typeof(selector) != 'string') {
        if(selector instanceof Element) { // JS or jQuery 
            return [selector];
        }
        else {
            let to_return = [];
            
            for(const obj of selector) {
                if(obj instanceof Element) {
                    to_return.push(obj);    
                }
            }
            return to_return;
        }
    }
    
    // clean problematic selectors
    (selector.match(/(#[0-9][^\s:,]*)/g) || []).forEach(function(n) {
        selector = selector.replace(n, '[id="' + n.replace("#", "") + '"]');
    });
    
    return document.querySelectorAll(selector);
};

// Global function to search emojis by keyword for typeahead
window.searchEmojiByKeyword = function(keyword) {
    if (!emoji_json || typeof emoji_json !== 'object') return [];
    
    keyword = keyword ? keyword.toLowerCase() : "";
    let results = [];
    
    for (const category in emoji_json) {
        if (emoji_json.hasOwnProperty(category)) {
            const items = emoji_json[category];
            for (const item of items) {
                let match = false;
                
                // If keyword is empty, just return the first ones
                if (!keyword) {
                    match = true;
                } else {
                    // Check if description or any keywords match
                    if (item.description.toLowerCase().includes(keyword)) {
                        match = true;
                    } else if (item.keywords && item.keywords.some(k => k.toLowerCase().includes(keyword))) {
                        match = true;
                    }
                }
                
                if (match) {
                    results.push(item);
                    if (results.length >= 20) {
                        return results;
                    }
                }
            }
        }
    }
    
    return results;
};
