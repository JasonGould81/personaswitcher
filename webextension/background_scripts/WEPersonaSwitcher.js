/* global browser */
/* eslint no-constant-condition: 0 */
'use strict';

function handleStartup() 
{
    var checkDefaultsLoaded = browser.storage.local.get("defaults_loaded");
    checkDefaultsLoaded
    .then(loadDefaultsIfNeeded)
    .then(setLogger)
    .then(startRotateAlarm)
    .then(getMenuData)
    .then(buildMenu)
    .then(rotateOnStartup)
    .then(function() 
    {
        return browser.storage.onChanged.addListener(handlePreferenceChange);
    })
    .catch(handleError);
}

// Verify if we need to load the default preferences by checking if the 
// default_loaded flag is undefined. 
function loadDefaultsIfNeeded(prefs) 
{
        if ('undefined' === typeof(prefs.defaults_loaded)) 
        {
            return loadDefaults();
        } 
        return Promise.resolve();
}

function loadDefaults()
{
    var getLegacyPrefs = browser.runtime.sendMessage({command: "Return-All-Prefs"});

    return getLegacyPrefs
        .then(function(prefs) 
        {
            return Promise.resolve(buildPrefsStorageArg(prefs));            
        })
        .then(function(prefsStorageArg)
        {
            browser.storage.local.set(prefsStorageArg).then(
                function() 
                { 
                    return Promise.resolve();
                });
        });        
}

function buildPrefsStorageArg(prefs) 
{
    // The arrays hold the keys for the preferences in the bootstrap addon,
    // the WebExtension, and the default values for the preferences. 
    // The index for a particular preference MUST be kept consistent between
    // all three arrays.
    var prefKeyOld = [
        "defshift", "defcontrol", "defalt", "defmeta", "defaccel", "defos",
        "defkey", "rotshift", "rotcontrol", "rotalt", "rotmeta", "rotaccel",
        "rotos", "rotkey", "autoshift", "autocontrol", "autoalt", "autometa",
        "autoaccel", "autoos", "autokey", "activateshift", "activatecontrol",
        "activatealt", "activatemeta", "activateaccel", "activateos",
        "activatekey", "toolsshift", "toolscontrol", "toolsalt", "toolsmeta",
        "toolsaccel", "toolsos", "toolskey", "accesskey", "auto", "autominutes",
        "random", "preview", "preview-delay", "icon-preview", "tools-submenu",
        "main-menubar", "debug", "toolbox-minheight", "startup-switch",
        "fastswitch", "current"];

    var prefKeyWE = [
        "defaultKeyShift", "defaultKeyControl", "defaultKeyAlt",
        "defaultKeyMeta", "defaultKeyAccel", "defaultKeyOS", "defaultKey",
        "rotateKeyShift", "rotateKeyControl", "rotateKeyAlt", "rotateKeyMeta",
        "rotateKeyAccel", "rotateKeyOS", "rotateKey", "autoKeyShift",
        "autoKeyControl", "autoKeyAlt", "autoKeyMeta", "autoKeyAccel",
        "autoKeyOS", "autoKey", "activateKeyShift", "activateKeyControl",
        "activateKeyAlt", "activateKeyMeta", "activateKeyAccel",
        "activateKeyOs", "activateKey", "toolsKeyShift", "toolsKeyControl",
        "toolsKeyAlt", "toolsKeyMeta", "toolsKeyAccel", "toolsKeyOs",
        "toolsKey", "accessKey", "auto", "autoMinutes", "random", "preview",
        "previewDelay", "iconPreview", "toolsMenu", "mainMenuBar", "debug",
        "toolboxMinHeight", "startupSwitch", "fastSwitch", "current"];

    var defaultVals = [
        'false', 'true', 'true', 'false', 'false', 'false', 'D',
        'false', 'true', 'true', 'false', 'false', 'false', 'R',
        'false', 'true', 'true', 'false', 'false', 'false', 'A',
        'false', 'true', 'true', 'false', 'false', 'false', 'P',
        'false', 'true', 'true', 'false', 'false', 'false', 'M',
        'P', 'false', '30', 'false', 'false', '0', 'true', 'true',
        'false', 'false', '0', 'false', 'false', '0'];


    var prefsStorageArg = {};
    // WebExtension only preferences are simply set to the default values.
    prefsStorageArg['toolboxMaxHeight'] = 200;
    prefsStorageArg['defaults_loaded'] = true;

    // All other preferences are assigned either the value present in the 
    // equivalent legacy preference or the default value if no existing value
    // could be found.
    for(let index = 0; index < prefKeyWE.length; index++)
    {
        var oldValue = prefs[prefKeyOld[index]];
        var valueToStore = 
            (null === oldValue || 'undefined' === typeof(oldValue)) 
                ? defaultVals[index] : oldValue;

        switch(prefKeyWE[index])
        {
            case 'defaultKeyShift':
            case 'defaultKeyControl':
            case 'defaultKeyAlt':
            case 'defaultKeyMeta':
            case 'defaultKeyAccel':
            case 'defaultKeyOS':
            case 'rotateKeyShift':
            case 'rotateKeyControl':
            case 'rotateKeyAlt':
            case 'rotateKeyMeta':
            case 'rotateKeyAccel':
            case 'rotateKeyOS':
            case 'autoKeyShift':
            case 'autoKeyControl':
            case 'autoKeyAlt':
            case 'autoKeyMeta':
            case 'autoKeyAccel':
            case 'autoKeyOS':
            case 'activateKeyShift':
            case 'activateKeyControl':
            case 'activateKeyAlt':
            case 'activateKeyMeta':
            case 'activateKeyAccel':
            case 'activateKeyOs':            
            case 'toolsKeyShift':
            case 'toolsKeyControl':
            case 'toolsKeyAlt':
            case 'toolsKeyMeta':
            case 'toolsKeyAccel':
            case 'toolsKeyOs':
            case 'auto':
            case 'random':
            case 'startupSwitch':
            case 'preview':
            case 'iconPreview':
            case 'toolsMenu':
            case 'mainMenuBar':
            case 'debug':
            case 'fastSwitch':
                prefsStorageArg[prefKeyWE[index]] = (valueToStore === 'true');
                break;
            case 'toolsKey':
            case 'activateKey':
            case 'accessKey':
            case 'autoKey':
            case 'rotateKey':
            case 'defaultKey':
                prefsStorageArg[prefKeyWE[index]] = valueToStore;
                break;
            case 'autoMinutes':
            case 'previewDelay':
            case 'toolboxMinHeight':
            case 'toolboxMaxHeight':
            case 'current':
                prefsStorageArg[prefKeyWE[index]] = parseInt(valueToStore);
                break;
        }
    }

    return prefsStorageArg;
}

function getMenuData() 
{
    var menuPreferences = ["iconPreview", "preview", "previewDelay", "current"];
    var getData = Promise.all([
        browser.storage.local.get(menuPreferences),
        browser.runtime.sendMessage({command: "Return-Theme-List"})
    ]);
    return Promise.resolve(getData);
}

var currentThemes;
var defaultThemes;
var browserActionMenu;
function buildMenu(data) 
{
    logger.log("Menu ", browserActionMenu);
    browserActionMenu = document.createElement("div");
    browserActionMenu.setAttribute("class", "menu");
    currentThemes = data[1].themes;
    defaultThemes = data[1].defaults;
    var indexOffset = currentThemes.length+1;
    for (var index = 0; index < currentThemes.length; index++) 
    {        
        browserActionMenu.
            appendChild(buildMenuItem(currentThemes[index], data[0], index));
    }

    insertSeparator();

    for (index = 0; index < defaultThemes.length; index++) 
    {        
        browserActionMenu.
            appendChild(buildMenuItem(defaultThemes[index], data[0],
                                                    index + indexOffset));
    }
    logger.log("Menu ", browserActionMenu);
}

function buildMenuItem(theme, prefs, theIndex) 
{
    var themeChoice = document.createElement("option");
    themeChoice.setAttribute("class", "button theme");
    var textNode = document.createTextNode(theme.name);
    themeChoice.appendChild(textNode);
    themeChoice.insertBefore(createIcon(theme.iconURL, prefs.iconPreview),
                             textNode);

    if (theIndex === prefs.current) 
    {
        themeChoice.selected = true;
    }

    if (true === prefs.preview) 
    {
        themeChoice.addEventListener('mouseenter',
                        mouseEnterListener(theme, prefs.previewDelay));
        themeChoice.addEventListener('mouseleave',
                        mouseLeaveListener(theme, prefs.preview));
    }
    themeChoice.addEventListener('click', clickListener(theme, theIndex));
    return themeChoice;
}

    
function createIcon(iconURL, iconPreview) 
{
    var themeImg = document.createElement("img");
    themeImg.setAttribute("class", "button icon");
    themeImg.setAttribute("src", iconURL);

    if (false === iconPreview) 
    {
        themeImg.style.display = "none";
    }    
    return themeImg;
}

function insertSeparator() 
{
    var separator = document.createElement("hr");
    separator.setAttribute("class", "menu-separator");
    browserActionMenu.appendChild(separator);
}

var clickListener = function(theTheme, theIndex) 
{ 
    return function() 
    {
        stopRotateAlarm(); 
        browser.storage.local.get("current").then((result) => 
            {
                setCurrentTheme(theIndex, result.current);
            });
        browser.runtime.sendMessage(
        {
            command: "Switch-Themes",
            theme: theTheme,
            index: theIndex
        });
        startRotateAlarm(); 
    };
};

var previewAlarmListener;
var mouseEnterListener = function(theTheme, previewDelay) 
{
    const MS_TO_MINUTE_CONVERSION = 60000;
    return function() 
    { 
        const delayInMinutes = previewDelay/MS_TO_MINUTE_CONVERSION;
        var innerAlarmListener = function(alarmInfo) 
        {
            browser.runtime.sendMessage(
                {
                    command: "Preview-Theme",
                    theme: theTheme
                }
            ); 
        };
        previewAlarmListener = innerAlarmListener;
        browser.alarms.create("previewAlarm", {delayInMinutes});
        browser.alarms.onAlarm.addListener(previewAlarmListener);
    };
};

var mouseLeaveListener = function(theTheme) 
{ 
    return function() 
    { 
        browser.alarms.clear("previewAlarm");
        browser.alarms.onAlarm.removeListener(previewAlarmListener);
        browser.runtime.sendMessage(
            {
                command: "End-Preview", 
                theme: theTheme
            }
        ); 
    };
};

function toggleMenuIcons(iconsShown) 
{
    var displayValue;
    if (true === iconsShown) 
    {
        displayValue = "inline";
    } 
    else 
    {
        displayValue = "none";
    }        
    
    var icons = browserActionMenu.querySelectorAll(".icon");
    for (var index = 0; index < icons.length; index++) 
    {
        logger.log("Icon Node", icons[index]);
        icons[index].style.display = displayValue;
    }
}

var rotateAlarmListener;
function startRotateAlarm() 
{    
    const ONE_SECOND = (1.0/60.0);
    logger.log("In Rotate Alarm");
    var checkRotatePref = browser.storage.local.
                            get(["auto", "autoMinutes", "fastSwitch"]);
    return checkRotatePref.then((results) => 
    { 
        // Because the WebExtension can't be notified to turn on/off the rotate
        // when the associated shortcut is pressed and processed in the bootstrap 
        // code, we have to run the alarm constantly. When the shortcuts are
        // migrated over to the WebExtension replace the if(true) with 
        // if(true === results.auto)
        if (true) 
        {    
            const periodInMinutes = results.fastSwitch ? ONE_SECOND :
                                                         results.autoMinutes;
            var innerAlarmListener = function(alarmInfo) 
            {
                if ("rotateAlarm" === alarmInfo.name) 
                {
                    autoRotate();
                } 
            };
            rotateAlarmListener = innerAlarmListener;
            browser.alarms.create("rotateAlarm", {periodInMinutes});
            browser.alarms.onAlarm.addListener(rotateAlarmListener);
        }
        return Promise.resolve();
    });
}

function stopRotateAlarm() 
{
    if ('undefined' !== typeof(rotateAlarmListener)) 
    {
        browser.alarms.clear("rotateAlarm");
        browser.alarms.onAlarm.removeListener(rotateAlarmListener);        
    }
}

// Because the legacy bootstrap code cannot initiate contact with the embedded 
// WebExtension, and because the shortcuts are still handled by the bootstrap 
// code, when the shortcut to toggle autoswitching is pressed the WebExtension is 
// unable to react. Thus, we have to check the bootstrap autoswitch preference 
// before we rotate to make sure that the preference is still true. Likewise, 
// even if the preference in the WebExtension code is false, it may have been 
// toggled on by a shortcut key press in the bootstrap code. Thus we have to 
// leave the periodic timer continually running and only respond when the 
// bootstrap code's auto preference is true. This is not optimal from a 
// performance standpoint but is necessary until the shortcuts can be migrated to 
// the WebExtension code.
function autoRotate() 
{
    var checkRotatePref = Promise.all([
            browser.storage.local.get("auto"),
            browser.runtime.sendMessage({command: "Return-Pref-Auto"})
        ]);    
        
    checkRotatePref.then((results) => 
    {
        if (true === results[1].auto) 
        {
            rotate();
        }
        
        // If the two preferences don't match, update the WebExtension's pref
        if(results[0].auto !== results[1].auto) 
        {
            browser.storage.local.set({auto: results[1].auto});
        }
    }, handleError);
}

function rotate() 
{
    if (1 >= currentThemes.length) return;

    // Because the shortcuts are still handled by the bootstrap code the  
    // currentIndex in the bootstrap code is always as (or more) accurate than 
    // the currentIndex stored in the Webextension due to use of the rotate 
    // shortcut. 
    var getRotatePref = Promise.all([
            browser.storage.local.get(["random", "current"]),
            browser.runtime.sendMessage({command: "Get-Current-Index"})
        ]);
    getRotatePref.then((results) => 
    {
        logger.log ("Current index before ", results[1].current);
        var newIndex = results[1].current;
        if (true === results[0].random)
        {
            var prevIndex = newIndex;
            // pick a number between 1 and the end until a new index is found
            while(newIndex === prevIndex) 
            {
                newIndex = Math.floor ((Math.random() *
                        (currentThemes.length-1)) + 1);
            }
        }
        else
        {
            // If a default theme is active, rotate to the first non-default 
            // theme
            if(newIndex > currentThemes.length-1) 
            {
                newIndex = 0;
            } 
            else 
            {
                newIndex = (newIndex + 1) % currentThemes.length;
            }
        }

        logger.log ("Current index after ", newIndex);
        setCurrentTheme(newIndex, results[0].current);
        browser.runtime.sendMessage(
        {
            command: "Switch-Themes",
            theme: currentThemes[newIndex],
            index: newIndex
        });
    });    
}

function rotateOnStartup() 
{
    logger.log("Rotate on Startup");
    var checkRotateOnStartup = browser.storage.local.get("startupSwitch");
    checkRotateOnStartup.then((prefs) => 
    {
        if(true === prefs.startupSwitch) 
        {
            rotate();
        }
    });
}

function setCurrentTheme(newIndex, oldIndex)
{
    var themes = browserActionMenu.children;
    themes[oldIndex].selected = false;
    themes[newIndex].selected = true;

    if(newIndex !== oldIndex)
    {
        var updatingCurrentIndex = browser.storage.local.
                                        set({current: newIndex});
        updatingCurrentIndex.catch(handleError);  
    }
}

function handlePreferenceChange(changes, area) 
{ 
      var changedPrefs = Object.keys(changes);
 
      for (var pref of changedPrefs) 
      {
        if ('undefined' !== typeof(changes[pref].newValue) && 
            changes[pref].oldValue !== changes[pref].newValue) 
        {
            reactToPrefChange(pref, changes[pref]);
        }
    }
}

function reactToPrefChange(prefName, prefData) 
{
    switch (prefName) 
    {
        case 'iconPreview':
            browser.runtime.sendMessage({
                                            command: "Set-Preference",
                                             preference: prefName,
                                             value: prefData.newValue
                                        });
            toggleMenuIcons(prefData.newValue);
            break;
        case 'preview':
        case 'previewDelay':
            browser.runtime.sendMessage({
                                            command: "Set-Preference",
                                             preference: prefName,
                                             value: prefData.newValue
                                        });
            getMenuData().then(buildMenu, handleError);
            break;
        case 'debug':
            browser.runtime.sendMessage({
                                            command: "Set-Preference",
                                             preference: prefName,
                                             value: prefData.newValue
                                        });
            setLogger();
            break;
        case 'autoMinutes':
            browser.runtime.sendMessage({
                                            command: "Set-Preference",
                                             preference: prefName,
                                             value: prefData.newValue
                                        });
            stopRotateAlarm();
            startRotateAlarm();
            break;
        case 'fastSwitch':
        case 'auto':
            // When the shortcuts are migrated to the WebExtension code, 
            // turn off/on the rotate timer here.
            stopRotateAlarm();
            startRotateAlarm();
            // falls through
        case 'toolboxMinHeight':
        case 'startupSwitch':
        case 'random':
        case 'mainMenuBar':
        case 'toolsMenu':
        case 'defaultKeyShift':
        case 'defaultKeyControl':
        case 'defaultKeyAlt':
        case 'defaultKeyMeta':
        case 'defaultKeyAccel':
        case 'defaultKeyOS':
        case 'defaultKey':
        case 'rotateKeyShift':
        case 'rotateKeyControl':
        case 'rotateKeyAlt':
        case 'rotateKeyMeta':
        case 'rotateKeyAccel':
        case 'rotateKeyOS':
        case 'rotateKey':
        case 'autoKeyShift':
        case 'autoKeyControl':
        case 'autoKeyAlt':
        case 'autoKeyMeta':
        case 'autoKeyAccel':
        case 'autoKeyOS':
        case 'autoKey':
        case 'accessKey':
        case 'activateKeyShift':
        case 'activateKeyControl':
        case 'activateKeyAlt':
        case 'activateKeyMeta':
        case 'activateKeyAccel':
        case 'activateKeyOs':
        case 'activateKey':
        case 'toolsKeyShift':
        case 'toolsKeyControl':
        case 'toolsKeyAlt':
        case 'toolsKeyMeta':
        case 'toolsKeyAccel':
        case 'toolsKeyOs':
        case 'toolsKey':
        case 'current':
        case 'toolboxMaxHeight':
            browser.runtime.sendMessage({
                                            command: "Set-Preference",
                                             preference: prefName,
                                             value: prefData.newValue
                                        });
            break;
        default:
            logger.log(prefName, " " + prefData.newValue);
    }
}

browser.contextMenus.create(
{
      id: "PSOptions",
      title: "Persona Switcher Options",
      contexts: ["browser_action"]
});

browser.contextMenus.onClicked.addListener((info) => 
    {
        browser.runtime.openOptionsPage(); 
    });

var logger = console;
var nullLogger = {};
nullLogger.log = function (s) 
{ 
    'use strict'; 
    return; 
};
function setLogger() 
{
    var checkIfDebugging = browser.storage.local.get("debug");
    return checkIfDebugging.then((result) => 
    {
        if (true === result.debug) 
        {
            logger = console;
        } 
        else 
        {
            logger = nullLogger;
        }        
        return Promise.resolve();
    });
}

function handleError(error) 
{
    logger.log(`${error}`);
}

handleStartup();