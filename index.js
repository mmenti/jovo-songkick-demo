// 'use strict';

// =================================================================================
// App Configuration
// =================================================================================

const app = require('jovo-framework').Jovo;
const webhook = require('jovo-framework').Webhook;

// Listen for post requests
webhook.listen(3000, function() {
    console.log('Local development server listening on port 3000.');
});

webhook.post('/webhook', function(req, res) {
    app.handleRequest(req, res, handlers);
    app.execute();
});

// =================================================================================
// App Logic
// =================================================================================

var http = require('http');
var querystring = require('querystring');
var jsonmask = require('json-mask');

var sk_apikey = '<YOUR SONGKICK API KEY>';

eventsearch_callback = function(response) {
    var str = '';
    
    response.on('data', function (chunk) {
        str += chunk;
    });
    
    response.on('end', function () {
        var jsonObj = JSON.parse(str);
        if (jsonObj.resultsPage.status == "ok" && jsonObj.resultsPage.totalEntries > 0) {
            // store for 'next'
            // don't store the entire API response, only the data we're interested in
            var maskObj = jsonmask(jsonObj, 'resultsPage/(status,totalEntries,perPage,results/event/(location,start/date,venue/displayName))');
            app.setSessionAttribute('apiResult', JSON.stringify(maskObj));
            console.log(app.getSessionAttribute('apiResult'));
            app.setSessionAttribute('resultNum', 1);
            // pick the first match
            let city = jsonObj.resultsPage.results.event[0].location.city;
            let date = jsonObj.resultsPage.results.event[0].start.date;
            let venue = jsonObj.resultsPage.results.event[0].venue.displayName;
            app.followUpState('ArtistState').ask("The next show for " + app.getSessionAttribute('artist') + " is on " + date + " at " + venue + " in " + city + ". To hear the next show, say 'next'.", "Say 'next' to hear the next show, or 'stop' to end our session.");
        } else {
            app.tell("I'm sorry, I can't find any upcoming events for " + app.getSessionAttribute('artist'));
        }
    });
};

metroeventsearch_callback = function(response) {
    var str = '';
    
    response.on('data', function (chunk) {
        str += chunk;
    });
    
    response.on('end', function () {
        var jsonObj = JSON.parse(str);
        if (jsonObj.resultsPage.status == "ok" && jsonObj.resultsPage.totalEntries > 0 && jsonObj.resultsPage.perPage > 0) {
            // store for 'next'
            // don't store the entire API response, only the data we're interested in
            var maskObj = jsonmask(jsonObj, 'resultsPage/(status,totalEntries,perPage,results/event/displayName)');
            app.setSessionAttribute('apiResult', JSON.stringify(maskObj));
            console.log(app.getSessionAttribute('apiResult'));
            app.setSessionAttribute('resultNum', 1);
            // pick the first match
            let display = jsonObj.resultsPage.results.event[0].displayName;
            console.log("metroeventsearch_callback: display = " + display);
            app.followUpState('LocationState').ask("The next show in " + app.getSessionAttribute('location') + " is " + display + ". To hear the next show, say 'next'.", "Say 'next' to hear the next show, or 'stop' tp end our session.");
        } else {
            app.tell("I'm sorry, I can't find any upcoming events in " + app.getSessionAttribute('location'));
        }
    });
};

artistsearch_callback = function(response) {
    var str = '';
    
    response.on('data', function (chunk) {
        str += chunk;
    });
    
    response.on('end', function () {
        var jsonObj = JSON.parse(str);
        if (jsonObj.resultsPage.status == "ok" && jsonObj.resultsPage.totalEntries > 0) {
            // pick the first match
            artist_id = jsonObj.resultsPage.results.artist[0].id;
            // look up events for artist id
            let eventsearch = {
                host: 'api.songkick.com',
                path: '/api/3.0/artists/'+artist_id+'/calendar.json?per_page=25&apikey='+sk_apikey,
                port: '80',
                method: 'GET',
            };
            let req_eventsearch = http.request(eventsearch, eventsearch_callback);
            req_eventsearch.end();
        } else {
            app.tell("I'm sorry, there was a problem looking up the artist name " + app.getSessionAttribute('artist') + " at Songkick.");
        }
    });
};

locationsearch_callback = function(response) {
    var str = '';
    
    response.on('data', function (chunk) {
        str += chunk;
    });
    
    response.on('end', function () {
        var jsonObj = JSON.parse(str);
        if (jsonObj.resultsPage.status == "ok" && jsonObj.resultsPage.totalEntries > 0) {
            // pick the first match
            metro_id = jsonObj.resultsPage.results.location[0].metroArea.id;
            console.log("locationsearch_callback: metro_id = " + metro_id);
            // look up events for metro area id
            let metroeventsearch = {
                host: 'api.songkick.com',
                path: '/api/3.0/metro_areas/'+metro_id+'/calendar.json?per_page=25&apikey='+sk_apikey,
                port: '80',
                method: 'GET',
            };
            let req_eventsearch = http.request(metroeventsearch, metroeventsearch_callback);
            req_eventsearch.end();
        } else {
            app.tell("I'm sorry, there was a problem looking up the location name " + app.getSessionAttribute('location') + " at Songkick.");
        }
    });
};

let handlers = {
    
    'LAUNCH': function() {
        let speech = 'You can ask us about gigs in your location, or about gigs for a specific artist or band.';
        let reprompt = 'For example, you could say "who is playing in London?" or "when is Bob Dylan playing?"';
        app.ask(speech, reprompt);
    },

    'END': function() {
        app.tell("Goodbye from your friends at Songkick, looking forward to speaking to you again soo!");
    },
    
    'ArtistIntent': function(artist) {
        console.log("artist intent for artist " + artist);
        app.setSessionAttribute('artist', artist);
        // look up sk artist id
        let artistsearch = {
            host: 'api.songkick.com',
            path: '/api/3.0/search/artists.json?query='+escape(artist)+"&apikey="+sk_apikey,
            port: '80',
            method: 'GET',
        };
        let req_search = http.request(artistsearch, artistsearch_callback);
        req_search.end();
    },

    'LocationIntent': function(location) {
        console.log("location intent for location " + location);
        app.setSessionAttribute('location', location);
        // look up sk metro id
        let locationsearch = {
            host: 'api.songkick.com',
            path: '/api/3.0/search/locations.json?query='+escape(location)+"&apikey="+sk_apikey,
            port: '80',
            method: 'GET',
        };
        let req_search = http.request(locationsearch, locationsearch_callback);
        req_search.end();
    },

    'ArtistState': {
        'NextIntent': function() {
            // get next artist result
            let apijson = app.getSessionAttribute('apiResult');
            let resnum = app.getSessionAttribute('resultNum');
            app.setSessionAttribute('resultNum', resnum + 1);
            var jsonObj = JSON.parse(apijson);
            if (jsonObj.resultsPage.status == "ok" && jsonObj.resultsPage.totalEntries > resnum) {
                // pick the resnum match
                let city = jsonObj.resultsPage.results.event[resnum].location.city;
                let date = jsonObj.resultsPage.results.event[resnum].start.date;
                let venue = jsonObj.resultsPage.results.event[resnum].venue.displayName;
                app.followUpState('ArtistState').ask("The next show for " + app.getSessionAttribute('artist') + " is on " + date + " at " + venue + " in " + city + ". To hear the next show, say 'next'.", "Say 'next to hear the next show, or 'stop' to end our session.");
            } else {
                app.tell("I'm sorry, I can't find any more upcoming events for " + app.getSessionAttribute('artist'));
            }
        },
    }, 
    'LocationState': {
        'NextIntent': function() {
            let apijson = app.getSessionAttribute('apiResult');
            let resnum = app.getSessionAttribute('resultNum');
            app.setSessionAttribute('resultNum', resnum + 1);
            var jsonObj = JSON.parse(apijson);
            if (jsonObj.resultsPage.status == "ok" && jsonObj.resultsPage.totalEntries > resnum & jsonObj.resultsPage.perPage > resnum) {
                // pick the resnum match
                let display = jsonObj.resultsPage.results.event[resnum].displayName;
                app.followUpState('LocationState').ask("The next show in " + app.getSessionAttribute('location') + " is " + display + ". To hear the next show, say 'next'.", "Say 'next' to hear the next show, or 'stop' to end our session.");
            } else {
                app.tell("I'm sorry, I can't find any more upcoming events in " + app.getSessionAttribute('location'));
            }
        },
    }, 

};
