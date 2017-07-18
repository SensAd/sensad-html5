// Copyright 2017, SensAd

/* ---------------------------------------------- */
/* ---------------------------------- SENSADSTATE */
/* ---------------------------------------------- */

var SensAdState = function (adCallback, pauseCallback, resumeCallback) {

  var queue = [];
  var started = false;
  var lastTimeCode = 0;
  var busy = false;

  var onTimeCodeChanged = function (timeCode, inSession) {
    if (!started) {
      if (__SensAdDebug__) {
        console.log(`SensAdState.onTimeCodeChanged: skipping as not started`);
      }
      return;
    }
    if (busy && !inSession) {
      if (__SensAdDebug__) {
        console.log(`SensAdState.onTimeCodeChanged: skipping as busy and not in session`);
      }
      return;
    }
    if (queue.length) {

      // collect video ads
      var pod = [];
      for (var insert of queue) {
        if (insert.at <= timeCode && insert.ad.video) {
          pod.push(insert);
        }
      }

      // if any video ads, remove them from queue then play them
      if (pod.length) {
        if (__SensAdDebug__) {
          console.log(`SensAdState.onTimeCodeChanged: found ${pod.length} video ads at timeCode ${timeCode}`);
        }
        for (var insert of pod) {
          var index = queue.indexOf(insert);
          queue.splice(index, 1);
        }

        if (__SensAdDebug__) {
          console.log(`SensAdState.onTimeCodeChanged: removed ${pod.length} from queue, will play them in sequence`);
        }

        return onPod(pod, 0);
      }

      // if no video ads show the next overlay ad
      if (queue[0].at <= timeCode) {
        if (__SensAdDebug__ && !inSession) {
          console.log(`SensAdState.onTimeCodeChanged: session started`);
        }
        if (__SensAdDebug__) {
          console.log(`SensAdState.onTimeCodeChanged: found overlay ad`);
        }
        // show ad
        busy = true;
        var ad = queue.shift().ad;
        ad.doneCallback = function () {
          onTimeCodeChanged(timeCode, true);
        };
        return adCallback(ad);
      } else {
        if (__SensAdDebug__) {
          console.log(`SensAdState.onTimeCodeChanged: ${queue.length} ads in queue, none of them prior ${timeCode}`);
        }
      }
    } else {
      if (__SensAdDebug__) {
        console.log(`SensAdState.onTimeCodeChanged: empty queue at ${timeCode}`);
      }
    }
    if (__SensAdDebug__ && inSession) {
      console.log(`SensAdState.onTimeCodeChanged: session ended`);
    }
    busy = false;
  };

  var onPod = function (pod, index) {
    if (!started) {
      if (__SensAdDebug__) {
        console.log(`SensAdState.onPod: skipping as not started`);
      }
      return;
    }

    if (0 === index) {
      busy = true;
      pauseCallback();
    }

    // show ad
    if (index < pod.length) {
      adCallback(pod[index].ad, function () {
        onPod(pod, ++index);
      });
    } else {
      busy = false;
      resumeCallback();
    }

  };

  this.at = function (timeCode) {

    // skip if not started
    if (!started) {
      return;
    }

    // skip if no change
    if (lastTimeCode === timeCode) {
      return;
    }

    onTimeCodeChanged(timeCode, false);

    lastTimeCode = timeCode;
  };

  this.schedule = function (at, ad) {
    if (started) {
      if (__SensAdDebug__) {
        console.log(`SensAdState.schedule: skipping as already started`);
      }
      return;
    }
    if (__SensAdDebug__) {
      console.log(`SensAdState.schedule: at ${at}`);
    }
    queue.push({ at: at, ad: ad });
  };

  this.scheduleSpot = function (ad) {
    if (!started) {
      if (__SensAdDebug__) {
        console.log(`SensAdState.scheduleSpot: skipping as not yet started`);
      }
      return;
    }
    if (__SensAdDebug__) {
      console.log(`SensAdState.scheduleSpot`);
    }
    queue.unshift({ at: lastTimeCode, ad: ad });
  };

  this.start = function () {
    if (__SensAdDebug__) {
      console.log(`SensAdState.start`);
    }
    started = true;
    onTimeCodeChanged(0, false);
  };

  this.stop = function () {
    if (__SensAdDebug__) {
      console.log(`SensAdState.stop`);
    }
    started = false;
  };

  this.started = function () {
    return started;
  };

};

/* ---------------------------------------------- */
/* ---------------------------------- SENSADSTYLE */
/* ---------------------------------------------- */

var SensAdStyle = function (ad) {

  var inMillis = 500;
  var outMillis = 400;

  var K4W = 3840;  /* UHD 4K width */
  var K4H = 2160;  /* UHD 4K height */

  var slowAnimations = arguments[5] ? 10 : 1;

  var stack = ["position:absolute", `background-image:url(${ad.imgUrl})`, `background-position:${ad.left ? "left" : "right"}`, "background-repeat:no-repeat"];

  if (ad.expander) {
    stack.push("background-size:auto 100%");
    stack.push("background-clip:content-box");
    stack.push("padding-right:60px");
  } else {
    stack.push("background-size:cover");
  }

  var rationaleW = function (size) {
    return (Number(size) / K4W) * 100;
  };

  var rationaleH = function (size) {
    return (Number(size) / K4H) * 100;
  };

  var freeIsLefty = function (ad) {
    if (!ad.free) {
      return undefined;
    }
    if (ad.left + (ad.width / 2) < (K4W / 2)) {
      return true;
    }
    return false;
  };

  this.style = function () {
    var result = `${stack.join(";")};`;
    if (__SensAdDebug__) {
      console.log(`SensAdStyle.style: ${result}`);
    }
    return result;
  };

  this.zIndex = function (videoZIndex) {
    if (videoZIndex) {
      if (ad.singledecorator || ad.doubledecorator) {
        stack.push(`z-index:${videoZIndex - 1}`);
      } else {
        stack.push(`z-index:${videoZIndex + 1}`);
      }
    }
    return this;
  };

  this.outOrigin = function () {
    if (ad.free) {
      stack.push(freeIsLefty(ad) ? (`left:-${rationaleW(ad.width)}%`) : (`right:-${rationaleW(ad.width)}%`));
      stack.push(`bottom:${rationaleH(K4H - ad.top - ad.height)}%`);
    } else if (ad.singledecorator || ad.doubledecorator) {
      stack.push(ad.left ? ("right:0") : ("left:0"));
      stack.push("top:0");
    } else if (ad.expander) {
      stack.push(`${ad.left ? "left" : "right"}:calc(-${rationaleW(ad.collapsed ? ad.width : ad.expandedWidth)}% - 60px)`);
      stack.push("bottom:5%");
    } else {
      stack.push(ad.left ? (`left:-${rationaleW(ad.width)}%`) : (`right:-${rationaleW(ad.width)}%`));
      stack.push("bottom:0");
    }
    return this;
  };

  this.inOrigin = function () {
    if (ad.free) {
      stack.push(freeIsLefty(ad) ? (`left:${rationaleW(ad.left)}%`) : (`right:${rationaleW(K4W - ad.left - ad.width)}%`));
      stack.push(`bottom:${rationaleH(K4H - ad.top - ad.height)}%`);
    } else if (ad.singledecorator || ad.doubledecorator) {
      stack.push(ad.left ? `right:0` : `left:0`);
      stack.push(`top:0`);
    } else {
      stack.push(ad.left ? `left:0` : `right:0`);
      stack.push(`bottom:${ad.expander ? "5%" : "0"}`);
    }
    return this;
  };

  this.expandedSize = function () {
    if (ad.expander) {
      stack.push(`width:calc(${rationaleW(ad.expandedWidth)}% + 60px)`);
      stack.push(`height:${rationaleH(ad.expandedHeight || ad.height)}%`);
    } else if (ad.singledecorator || ad.doubledecorator) {
      stack.push(`width:100%`);
      stack.push(`height:100%`);
    } else {
      stack.push(`width:${rationaleW(ad.width)}%`);
      stack.push(`height:${rationaleH(ad.expandedHeight || ad.height)}%`);
    }
    
    return this;
  };

  this.collapsedSize = function () {
    if (ad.expander) {
      stack.push(`width:calc(${rationaleW(ad.width)}% + 60px)`);
      stack.push(`height:${rationaleH(ad.height)}%`);
    } else if (ad.singledecorator) {
      stack.push(`width:80%`);
      stack.push(`height:80%`);
    } else if (ad.doubledecorator) {
      stack.push(`width:60%`);
      stack.push(`height:60%`);
    } else {
      stack.push(`width:${rationaleW(ad.width)}%`);
      stack.push(`height:${rationaleH(ad.height)}%`);
    }
    
    return this;
  };

  this.size = function () {
    if (ad.expander) {
      stack.push(`width:calc(${rationaleW(ad.collapsed ? ad.width : ad.expandedWidth)}% + 60px)`);
    } else {
      stack.push(`width:${rationaleW(ad.width)}%`);
    }
    stack.push(`height:${rationaleH(ad.expandedHeight || ad.height)}%`);
    return this;
  };

  this.animateIn = function (cb) {
    stack.push("transition-property:all",
      `transition-duration:${(inMillis / 1000) * slowAnimations}s`,
      "transition-timing-function:ease-out");
    setTimeout(cb, inMillis * slowAnimations);
    return this;
  };

  this.animateOut = function (cb) {
    stack.push("transition-property:all",
      `transition-duration:${(outMillis / 1000) * slowAnimations}s`,
      "transition-timing-function:ease-out");
    setTimeout(cb, outMillis * slowAnimations);
    return this;
  };

  return this;
};

/* ---------------------------------------------- */
/* --------------------------------------- SENSAD */
/* ---------------------------------------------- */

var SensAd = function (apiKey, email, videoId, videoZIndex) {

  /* ---------------------------------------------- */
  /* ---------------------------------------- SETUP */
  /* ---------------------------------------------- */

  if (!videoId) {
    return undefined;
  }

  var videoElement = document.getElementById(videoId);
  var videoContainerElement = videoElement.parentElement;

  if (!videoElement || !videoContainerElement) {
    return undefined;
  }

  var _address = arguments[4];
  var _customHandler = arguments[5];

  var state;

  /* ---------------------------------------------- */
  /* ---------------------------------------- UTILS */
  /* ---------------------------------------------- */

  var unPad = function (string) {
    return parseInt(Number(string));
  };

  var stringToTimeCode = function (string) {
    var split = string.split ? string.split(":") : [];
    if (3 !== split.length) {
      return undefined;
    }
    var timeCode = 0;
    var secs = [3600, 60, 1];
    for (var i = 0; i < split.length; i++) {
      var number = unPad(split[i]);
      if (!Number.isFinite(number)) {
        return undefined;
      }
      timeCode += number * secs[i];
    }
    return timeCode;
  };

  var get = function (url, cb) {
    if (!state.started()) {
      if (__SensAdDebug__) {
        console.log(`SensAd.get(pre call): not started`);
      }
      return;
    }
    if (0 != url.indexOf("http")) {
      url = (_address || "https://ad.sensad.net") + url;
    }
    var xhr = new XMLHttpRequest();
    xhr.addEventListener("load", function () {
      if (state.started()) {
        if (cb) {
          cb(this.responseText, xhr.status);
        }
      } else {
        if (__SensAdDebug__) {
          console.log(`SensAd.get(on success): not started`);
        }
      }
    });
    xhr.addEventListener("error", function (e) {
      if (state.started()) {
        if (cb) {
          cb(this.responseText, xhr.status);
        }
      } else {
        if (__SensAdDebug__) {
          console.log(`SensAd.get(on error): not started`);
        }
      }
    });
    xhr.open("GET", url);
    xhr.send();
  };

  /*  
  var disposeCurrentAd = function (cb) {
    if (!currentAd || !currentXd) {
      if (cb) {
        cb();
      }
      return
    }
    var node = (currentAd.singledecorator || currentAd.doubledecorator) ? videoElement : currentXd;
    slideOut(currentAd, node, cb);
  };

  var disposeTimeoutRefs = function () {
    for (var timeoutRef of /*timeoutRefs* /) {
      clearTimeout(timeoutRef);
    }
    //timeoutRefs = [];
  };
  */

  /* ---------------------------------------------- */
  /* ------------------------------------- EVENTING */
  /* ---------------------------------------------- */

  var eventListeners = {};

  var fireEventListener = function (event) {
    if (eventListeners[event]) {
      for (var cb of eventListeners[event]) {
        cb();
      }
    }
  };

  this.addEventListener = function (event, cb) {
    if (!eventListeners[event]) {
      eventListeners[event] = [];
    }
    eventListeners[event].push(cb);
  };

  this.removeEventListener = function (event, cb) {
    var listeners = eventListeners[event];
    var index = listeners.indexOf(cb);
    if (-1 < index) {
      eventListeners[event].splice(index, 1);
    }
  };

  var removeEventListeners = function (event) {
    if (event) {
      delete eventListeners[event];
    } else {
      eventListeners = [];
    }
  };
  this.removeEventListeners = removeEventListeners;


  /* ---------------------------------------------- */
  /* ------------------------------------------ IAB */
  /* ---------------------------------------------- */

  var parseVASTNode = function (dom, nsr, vastNode, ad) {
    var adIter = dom.evaluate('.//v:Ad', vastNode, nsr);
    var adNode = adIter.iterateNext();
    while (adNode) {
      var advertId = adNode.getAttribute("id");
      ad.id = advertId;
      ad.impressionUrls = [];

      var impIter = dom.evaluate('//v:Ad[@id="' + advertId + '"]/v:InLine/v:Impression', adNode, nsr);
      var impNode = impIter.iterateNext();
      while (impNode) {
        ad.impressionUrls.push(impNode.textContent);

        impNode = impIter.iterateNext();
      }

      var nlIter = dom.evaluate('//v:Ad[@id="' + advertId + '"]/v:InLine/v:Creatives/v:Creative/v:NonLinearAds/v:NonLinear', adNode, nsr);
      var nlNode = nlIter.iterateNext();
      while (nlNode) {
        var creativeId = nlNode.getAttribute("id");
        ad.creativeId = creativeId;
        var type = nlNode.getAttribute("r:type");
        if (type && type.length) {
          ad.type = type;
          switch (ad.type) {
            case "sidebar": ad.sidebar = true; break;
            case "expander": ad.expander = true; break;
            case "singledecorator": ad.singledecorator = true; break;
            case "doubledecorator": ad.doubledecorator = true; break;
            case "free": ad.free = true; break;
          }
        }
        var side = nlNode.getAttribute("r:side");
        if (side && side.length) {
          ad.side = side;
          switch (ad.side) {
            case "lefty": ad.left = true; break;
            case "righty": ad.right = true; break;
          }
        }
        if (ad.free) {
          var left = Number(nlNode.getAttribute("r:left"));
          var top = Number(nlNode.getAttribute("r:top"));
          if (isNaN(left) || isNaN(top)) {
            return false;
          }
          ad.left = left;
          ad.top = top;
        }

        var width = Number(nlNode.getAttribute("width"));
        var height = Number(nlNode.getAttribute("height"));
        if (isNaN(width) || isNaN(height)) {
          return false;
        }
        ad.width = width;
        ad.height = height;
        var expandedWidth = nlNode.getAttribute("expandedWidth");
        var expandedHeight = nlNode.getAttribute("expandedHeight");
        if (expandedWidth && expandedWidth.length && expandedHeight && expandedHeight.length) {
          expandedWidth = Number(expandedWidth);
          expandedHeight = Number(expandedHeight);
          if (isNaN(expandedWidth) || isNaN(expandedHeight)) {
            return false;
          }
          ad.expandedWidth = expandedWidth;
          ad.expandedHeight = expandedHeight;
        }
        var minDuration = nlNode.getAttribute("minSuggestedDuration");
        minDuration = stringToTimeCode(minDuration);
        if (isNaN(minDuration)) {
          return false;
        }
        if (minDuration <= 0) {
          ad.minDuration = Number.MAX_SAFE_INTEGER;
        } else {
          ad.minDuration = minDuration * 1000;
        }

        var hidden = nlNode.getAttribute("r:hidden");
        if (hidden && hidden.length) {
          hidden = Number(hidden);
          if (isNaN(hidden)) {
            return false;
          }
          ad.hidden = hidden;
        }
        var forced = nlNode.getAttribute("r:forced");
        if (forced && forced.length) {
          forced = Number(forced);
          if (isNaN(forced)) {
            return false;
          }
          ad.forced = forced;
        }

        var imgIter = dom.evaluate('//v:Ad[@id="' + advertId + '"]/v:InLine/v:Creatives/v:Creative/v:NonLinearAds/v:NonLinear[@id="' + creativeId + '"]/v:StaticResource', adNode, nsr);
        var imgNode = imgIter.iterateNext();
        while (imgNode) {
          ad.imgUrl = imgNode.textContent;

          imgNode = imgIter.iterateNext();
        }

        var nlctIter = dom.evaluate('//v:Ad[@id="' + advertId + '"]/v:InLine/v:Creatives/v:Creative/v:NonLinearAds/v:NonLinear[@id="' + creativeId + '"]/v:NonLinearClickThrough', adNode, nsr);
        var nlctNode = nlctIter.iterateNext();
        while (nlctNode) {
          ad.webUrl = nlctNode.textContent;

          nlctNode = nlctIter.iterateNext();
        }

        var nlctrIter = dom.evaluate('//v:Ad[@id="' + advertId + '"]/v:InLine/v:Creatives/v:Creative/v:NonLinearAds/v:NonLinear[@id="' + creativeId + '"]/r:NonLinearClickThrough', adNode, nsr);
        var nlctrNode = nlctrIter.iterateNext();
        while (nlctrNode) {
          ad.pushUrl = nlctrNode.textContent;

          nlctrNode = nlctrIter.iterateNext();
        }

        nlNode = nlIter.iterateNext();
      }

      ad.trxEvents = {};
      var trxIter = dom.evaluate('//v:Ad[@id="' + advertId + '"]/v:InLine/v:Creatives/v:Creative/v:NonLinearAds/v:TrackingEvents/v:Tracking', adNode, nsr);
      var trxNode = trxIter.iterateNext();
      while (trxNode) {
        var eventName = trxNode.getAttribute("event");
        if (!ad.trxEvents[eventName]) {
          ad.trxEvents[eventName] = [];
        }
        ad.trxEvents[eventName].push(trxNode.textContent);

        trxNode = trxIter.iterateNext();
      }

      adNode = adIter.iterateNext();
    }
  };

  var parseVMAP = function (xml, state) {
    var domParser = new DOMParser();
    var dom = domParser.parseFromString(xml, "text/xml");
    var nsr = dom.createNSResolver(dom);
    var abIter = dom.evaluate('//m:AdBreak', dom, nsr);
    var abNode = abIter.iterateNext();
    while (abNode) {
      var timeOffset = abNode.getAttribute("timeOffset");
      var ad = {};

      var vastIter = dom.evaluate('//m:AdBreak[@timeOffset="' + timeOffset + '"]/m:AdSource/m:VASTAdData/v:VAST', abNode, nsr);
      var vastNode = vastIter.iterateNext();
      while (vastNode) {
        parseVASTNode(dom, nsr, vastNode, ad);
        
        //vastNode = vastIter.iterateNext(); one ad per time offset yet
        vastNode = undefined;
      }

      if (ad.hasOwnProperty("id")) {
        state.schedule(stringToTimeCode(timeOffset), ad);
      }

      abNode = abIter.iterateNext();
    }
  };

  var parseVAST = function (xml) {
    var ad = {};
    var domParser = new DOMParser();
    var dom = domParser.parseFromString(xml, "text/xml");
    var nsr = dom.createNSResolver(dom);
    var vastIter = dom.evaluate('//v:VAST', dom, nsr);
    var vastNode = vastIter.iterateNext();
    parseVASTNode(dom, nsr, vastNode, ad);
    return ad;
  };

  /* ---------------------------------------------- */
  /* ---------------------------------------- TRACK */
  /* ---------------------------------------------- */

  var trackImpression = function (ad) {
    for (var url of ad.impressionUrls) {
      get(url);
    }
    trackCreativeView(ad);
  };

  var trackCreativeView = function (ad) {
    if (ad.trxEvents && ad.trxEvents.creativeView) {
      for (var url of ad.trxEvents.creativeView) {
        get(url);
      }
    }
  };

  var trackExpanded = function (ad) {
    if (ad.trxEvents && ad.trxEvents.expand) {
      for (var url of ad.trxEvents.expand) {
        get(url);
      }
    }
  };

  var trackCollapsed = function (ad) {
    if (ad.trxEvents && ad.trxEvents.collapse) {
      for (var url of ad.trxEvents.collapse) {
        get(url);
      }
    }
  };

  var trackClose = function (ad) {
    if (ad.trxEvents && ad.trxEvents.close) {
      for (var url of ad.trxEvents.close) {
        get(url);
      }
    }
  };

  /* ---------------------------------------------- */
  /* -------------------------------------- ROUTING */
  /* ---------------------------------------------- */

  var handleClick = function (ad) {
    var toWeb = function () {
      if (ad.webUrl && ad.webUrl.length) {
        window.open(ad.webUrl);
      }
    }
    if (ad.pushUrl && ad.pushUrl.length) {
      get(ad.pushUrl, function (r, code) {
        if (404 === code) {
          toWeb();
        }
      });
    } else {
      toWeb();
    }
  };

  /* ---------------------------------------------- */
  /* ---------------------------------- POSITIONING */
  /* ---------------------------------------------- */

  var kickOff = function (ad) {
    if (__SensAdDebug__) {
      console.log(`SensAd.kickOff: putting to initial position`);
    }
    ad.xd.setAttribute("style", new SensAdStyle(ad).zIndex(videoZIndex).outOrigin().expandedSize().style());
    setTimeout(function () {
      if (__SensAdDebug__) {
        console.log(`SensAd.kickOff: sliding in`);
      }
      if (ad.singledecorator || ad.doubledecorator) {
        videoElement.setAttribute("style", new SensAdStyle(ad).inOrigin().collapsedSize().animateIn(function () {
          trackImpression(ad);
          scheduleSlideOut(ad);
        }).style());
      } else {
        ad.xd.setAttribute("style", new SensAdStyle(ad).zIndex(videoZIndex).inOrigin().collapsedSize().animateIn(function () {
          trackImpression(ad);
          if (ad.expander) {
            scheduleCollapse(ad);
          } else {
            scheduleSlideOut(ad);
          }
        }).style());
      }
    }, 100);
  };

  var slideOut = function (ad) {
    if (__SensAdDebug__) {
      console.log(`SensAd.slideOut`);
    }
    destroyTimeout(ad);
    if (ad.singledecorator || ad.doubledecorator) {
      videoElement.setAttribute("style", new SensAdStyle(ad).outOrigin().expandedSize().animateOut(function () {
        ad.xd.remove();
        if (__SensAdDebug__) {
          console.log(`SensAd.slideOut: ad removed, calling doneCallback`);
        }
        ad.doneCallback();
      }).style());
    } else {
      ad.xd.setAttribute("style", new SensAdStyle(ad).zIndex(videoZIndex).outOrigin().size().animateOut(function () {
        ad.xd.remove();
        if (__SensAdDebug__) {
          console.log(`SensAd.slideOut: ad removed, calling doneCallback`);
        }
        ad.doneCallback();
      }).style());
    }
  };

  var collapse = function (manual, ad) {
    if (ad.collapsed) {
      if (__SensAdDebug__) {
        console.log(`SensAd.collapse: already collapsed`);
      }
      return scheduleSlideOut(ad);
    }
    destroyTimeout(ad);
    if (__SensAdDebug__) {
      console.log(`SensAd.collapse: collapsing`);
    }

    if (ad.counterRef) {
      clearInterval(ad.counterRef);
      delete ad.counterRef;

      if (ad.expander && !ad.closeHandle) {
        ad.counter.remove();
        ad.closeHandle = document.createElement("div");
        ad.xd.appendChild(ad.closeHandle);
        ad.closeHandle.setAttribute("style", `position:absolute;top:0;${ad.left ? "right:0" : "left:0"};width:60px;height:50%;background-color:rgba(81, 81, 81, 0.7);background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAsCAYAAAAehFoBAAAABGdBTUEAALGPC/xhBQAAAl5JREFUWAnV2T9OwzAUBnDsqiBmBhBQurFUYq04AgdgRGLiXEiMHIAjoG4IqQtbVUAwMCNATdCX6kWuY8fPznMFHkjrP+/7NTRWm25stLTp6HyzZTjLUHLm/PB0+6F/dPW4NTzLInMURRYyke0YrrqUawALPt5fLlRZ7GNc9XqTk6/ZnWuuVB+w5WIxRr1S6ded3YObwfP9p12/AbaxtCAn2sRSng+9AvZhqUgOtAtLeS50DQ5hqYgkug1LeTa6AnOxVEQCzcFSnolW2EZ+niaXdIHRpNCxCzoGSw6g+8fjaz2a3n5rreY0wD3iikYwdz7NS8FiLYyw1u/h1EIxZ1oiowbjVUgURB1Xk6q9AkaQVGETLVmzAZZGS2Jhc4Kl0NLYVnBXNNbTZwM85rbQRew9wxSQcpZKpWaqLIdUg3sMYVEnCMakGHROLBvMRefGRoFD6HVgo8E+9LqwSWAbvU5sMpjQRVHs5doNkOFq2tXJ7UvB4j/Cre+ax9rW7IUx25y51nz7cPZccy09jgZLYOvwhG/jUWBJbCqaDc6BTUGzwDmxseggeB3YGHTrtpaKxQ6gtX4jCPfI+WLrPcNdsHQfTqKG/WKdYMkgyVrAN8DSAQiRrLkCliwMqNmkatdgqYIm0n4skVGBJQrZON/zrlkaNwOLohz4Anz9qR9esINgra+urx9GWKsz/K9ut9Ir4qJTzyzlmEfO28O8N4y19UWHJyG0JBZ5aG1oG4v5K2B0+NA5sMhDc6FdWMxtgNFpo3NikYdmon3Y5UzPX6D/4g+LHu6yO/ln1Naq7YOhzF+NJnMeXvjcogAAAABJRU5ErkJggg==);background-size:auto 30%;background-repeat:no-repeat;background-position:center;`);
        ad.closeHandle.addEventListener("click", function (e) {
          if (e.target === this) {
            trackClose(ad);
            slideOut(ad);
          }
        });
        ad.toggleHandle = document.createElement("div");
        ad.xd.appendChild(ad.toggleHandle);
        ad.toggleHandle.setAttribute("style", `position:absolute;bottom:0;${ad.left ? "right:0" : "left:0"};width:60px;height:50%;background-color:rgba(81, 81, 81, 0.7);background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAAAsCAYAAADGiP4LAAAABGdBTUEAALGPC/xhBQAAAxNJREFUaAXd2kFy1DAQBdCYRQqOQFiw5QZZcAAqF8giVKpYcbEUm1yA4gi5AVsWwBFgxdB/6Da2LNndUksjj6qMPR61uvVmPHIKX1xUaIfD4bLCsKtD1sr5bDVrxptU6AsK+0D7m4zwrBDOhZzI7doGz9G4wHsa84rHfRqG4bNnjnAsxrnm8z9o/0A5f4X9cl+7AUVwpKZqSAGO5HNFcgFawZGi3ZESOJLPDakYSIEjRbshbeBIPhekIiADjhRdjKTEkXzFSNmrWAYOir6muHdSvXXPsfKDrAnHYnHPtWr6L/pkAWXiIPkf2r4tqtCfQCzGsLQiJPMlVojzSEvwV8vswr6U/w2du6XN+uFmXW4moFPjCFZLJDVQLzitkVRAveG0RNoE6hWnFdLqD13vOEDiH/1HOsxd3Z4LdmyfBNoDjkyoAOlAY7znucpws330EtsTznQ2VLflFuA7xb6kDV+S5C3AAmivOAKlRJriSGgUaQa0dxyZ6QZSDEdCF0gj0LngyEwTSGs4EjpDOgKdG47MNEDS4EjoiDScK47MlJHe0utXtCVXbek/2R+RLAGT2OM9Bz6RvTQrzjivnEsMN2Q/aUNSHBf/hU5jVGnBJWbJ8f8SkyjlpTbFkdAukTxwMMFxFcOLDaQYDsLQukLywsHEZkA4kUBaw0EYWhdInjiY1AIIJwMkDQ7C0E6K5I2DCUWB8AYj3dEhVjr8IGvbSZBq4GDCyWWe//v2E/VJIibEMOYtF5zo4nu6Fg6qTALhTUL6TbsH2rDsWVozpJo4mLDq20FF4KmJ6UMJWqyql1ttHDUQOvaG1ALHBNQTUiscM1APSC1xsoBOidQaB3NdXcXQIdb4FiB3dXsdG1N5DrHWmsc/PJU5Zt2sycbgTCQ8/vJlHMR4wLFPhrAiHORRLfNrBdHXXnsLUPxskNRBOW/oeOsxmGIc5CsGwiAKJDcc5EPbQHLBQR4XIC449U1yx0E+tASSGw5yuAFxwSFSNRzkQwuQXHH+ZXD+F5cbbR+5cOfR48MhF+fEB9R/o2IvW1dZK+dfOGD+CxzXrK0AAAAASUVORK5CYII=);background-size:auto 30%;background-repeat:no-repeat;background-position:center;`);
        ad.toggleHandle.addEventListener("click", function (e) {
          if (e.target === this) {
            if (ad.collapsed) {
              expand(ad);
            } else {
              collapse(1, ad);
            }
          }
        });
      }
    }

    ad.xd.setAttribute("style", new SensAdStyle(ad).zIndex(videoZIndex).inOrigin().collapsedSize().animateOut(function () {
      ad.collapsed = true;
      if (manual) {
        trackCollapsed(ad);
      }
      scheduleSlideOut(ad);
    }).style());
  };

  var expand = function (ad) {
    if (!ad.collapsed) {
      if (__SensAdDebug__) {
        console.log(`SensAd.expand: already expanded`);
      }
      return scheduleCollapse(ad);
    }
    destroyTimeout(ad);
    if (__SensAdDebug__) {
      console.log(`SensAd.expand: expanding`);
    }
    ad.xd.setAttribute("style", new SensAdStyle(ad).zIndex(videoZIndex).inOrigin().expandedSize().animateIn(function () {
      ad.collapsed = false;
      trackExpanded(ad);
      scheduleCollapse(ad);
    }).style());
  };

  /* ---------------------------------------------- */
  /* ----------------------- SCHEDULING POSITIONING */
  /* ---------------------------------------------- */

  var timeoutRef;
  var destroyTimeout = function (ad) {
    if (timeoutRef) {
      clearTimeout(timeoutRef);
      timeoutRef = undefined;
    }
  };

  var scheduleTimeout = function (ad, millis, cb) {
    destroyTimeout(ad);
    timeoutRef = setTimeout(cb, millis);
    if (__SensAdDebug__) {
      console.log(`SensAd.scheduleTimeout: in ${millis / 1000}s`);
    }
  };

  var scheduleCollapse = function (ad) {
    if (__SensAdDebug__) {
      console.log(`SensAd.scheduleCollapse`);
    }
    scheduleTimeout(ad, 5000, function () {
      collapse(0, ad);
    });
  };

  var scheduleSlideOut = function (ad) {
    var millisToGo = ad.minDuration;
    if (ad.expander) {
      millisToGo -= 5000;
    }
    millisToGo = Math.max(millisToGo, 0);
    if (__SensAdDebug__) {
      console.log(`SensAd.scheduleSlideOut`);
    }
    scheduleTimeout(ad, millisToGo, function () {
      slideOut(ad);
    });
  };

  /* ---------------------------------------------- */
  /* ------------------------------------ ON EVENTS */
  /* ---------------------------------------------- */


  var onClick = function (e) {
    if (e.target === this) {
      e.target.removeEventListener("click", onClick);
      slideOut
      if (_customHandler) {
        _customHandler(ad);
      } else {
        handleClick(ad);
      }
    }
  };

  var onTimeupdate = function () {
    if (seeking) {
      if (__SensAdDebug__) {
        console.log(`SensAd.onTimeupdate: not updating time during seek`);
      }
      return;
    }
    if (seeked) {
      if (__SensAdDebug__) {
        console.log(`SensAd.onTimeupdate: not updating time first time after seek`);
      }
      seeked = false;
      return;
    }
    var t = parseInt(videoElement.currentTime);
    state.at(t);
  };

  var seeking = false;
  var onSeeking = function () {
    if (__SensAdDebug__) {
      console.log(`SensAd.onSeeking`);
    }
    seeking = true;
  };
  var seeked = false;
  var onSeeked = function () {
    if (__SensAdDebug__) {
      console.log(`SensAd.onSeeked`);
    }
    seeking = false;
    seeked = true;
  };

  var onAd = function (ad) {
    if (__SensAdDebug__) {
      console.log(`SensAd.onAd: preloading ${ad.imgUrl}`);
    }
    
    var img;
    var timeoutRef

    var preload = function () {
      clearTimeout(timeoutRef);
      showAd(ad);
    };

    var onPreloadExpired = function () {
      img.removeEventListener("load", preload);
      if (__SensAdDebug__) {
        console.log(`SensAd.onAd: could not preload in 10s`);
      }
      ad.doneCallback();
    }
    
    img = new Image();
    img.addEventListener("load", preload);
    var timeoutRef = setTimeout(onPreloadExpired, 10000);
    
    img.src = ad.imgUrl;
  };

  var onShouldPause = function () {
    fireEventListener(SensAd.event.PAUSE_PLAYBACK);
  };

  var onShouldResume = function () {
    fireEventListener(SensAd.event.RESUME_PLAYBACK);
  };

  /* ---------------------------------------------- */
  /* ------------------------------------ LIFECYCLE */
  /* ---------------------------------------------- */

  var showAd = function (ad) {

    if (!ad || !ad.type) {
      if (__SensAdDebug__) {
        console.log(`SensAd.showAd: won't show ad to to ineligible`);
      }
      return cb();
    }

    if (__SensAdDebug__) {
      console.log(`SensAd.showAd: building ad`);
    }

    var xd = document.createElement("div");
    ad.xd = xd;
    xd.ad = ad;
    kickOff(ad);

    xd.addEventListener("click", onClick);

    if (ad.singledecorator || ad.doubledecorator) {
      videoContainerElement.insertBefore(xd, videoElement);
    } else {
      if (videoContainerElement.lastChild === videoElement) {
        videoContainerElement.appendChild(xd);
      } else {
        videoContainerElement.insertBefore(xd, videoElement.nextSibling);
      }
    }

    if (ad.expander) {

      ad.counter = document.createElement("div");

      ad.counter.spanContainer = document.createElement("div");
      ad.counter.spanContainer.setAttribute("style", "position:absolute;left:0;right:0;top:0;bottom:0;margin:auto;width:auto;height:40px;");
      ad.counter.appendChild(ad.counter.spanContainer);

      ad.counter.spanContainer.numberSpan = document.createElement("span");
      ad.counter.spanContainer.numberSpan.setAttribute("style", `font-size:2.6vmax;font-weight:500;font-family:Arial, sans-serif;color:rgba(255, 255, 255, 0.7);width:60px;display:block;margin-top:-2px;`);
      ad.counter.spanContainer.numberSpan.numberText = document.createTextNode("5");
      ad.counter.spanContainer.numberSpan.appendChild(ad.counter.spanContainer.numberSpan.numberText);
      ad.counter.spanContainer.appendChild(ad.counter.spanContainer.numberSpan);

      ad.counter.spanContainer.secSpan = document.createElement("span");
      ad.counter.spanContainer.secSpan.setAttribute("style", `font-size:2vmax;font-weight:500;font-family:Arial, sans-serif;color:rgba(255, 255, 255, 0.7);width:60px;display:block;`);
      ad.counter.spanContainer.secSpan.appendChild(document.createTextNode("sec"));
      ad.counter.spanContainer.appendChild(ad.counter.spanContainer.secSpan);

      xd.appendChild(ad.counter);
      ad.counter.setAttribute("style", `position:absolute;bottom:0;${ad.left ? "right:0" : "left:0"};width:60px;height:100%;background-color:rgba(81, 81, 81, 0.7);text-align:center;font-weight:500;font-family:Arial, sans-serif;color:rgba(255, 255, 255, 0.7);margin-top:auto;margin-bottom:auto;`);

      var counter = 4;
      ad.counterRef = intervalRef = setInterval(function () {
        ad.counter.spanContainer.numberSpan.numberText.nodeValue = counter--;
      }, 1000);
    }

  };

  this.adHoc = function (tags) {
    tags = tags.join(",");
    get(`/xd/${apiKey}/t/${encodeURIComponent(tags)}/e/${encodeURIComponent(email)}`, function (r, code) {
      if (200 === code) {
        var ad = parseVAST(r);
        if (ad.hasOwnProperty("id")) {
          state.scheduleSpot(ad);
        }
      }
    });
  };

  this.start = function (mediaId) {
    
    if (!state) {
      console.log("SensAd: Looks like this instance was already stopped. A stopped instance cannot be reused!");
      return;
    }

    if (__SensAdDebug__) {
      console.log(`SensAd.start`);
    }

    fireEventListener(SensAd.event.INIT_START);
    videoElement.addEventListener("timeupdate", onTimeupdate);
    videoElement.addEventListener("seeking", onSeeking);
    videoElement.addEventListener("seeked", onSeeked);
    if (mediaId && mediaId.length) {
      mediaId = encodeURIComponent(mediaId);
      get(`/xd/${apiKey}/m/${mediaId}/e/${encodeURIComponent(email)}`, function (r, code) {
        if (200 === code) {
          parseVMAP(r, state);
        }
        fireEventListener(SensAd.event.INIT_END);
        state.start();
      });
    } else {
      fireEventListener(SensAd.event.INIT_END);
      state.start();
    }
  };

  this.stop = function () {
    destroyTimeout();
    removeEventListeners();
    videoElement.removeEventListener("timeupdate", onTimeupdate);
    videoElement.removeEventListener("seeking", onSeeking);
    videoElement.removeEventListener("seeked", onSeeked);
    state.stop();
    
    if (__SensAdDebug__) {
      console.log(`SensAd.stop`);
    }
  };

  state = new SensAdState(onAd, onShouldPause, onShouldResume);
};

SensAd.event = {
  INIT_START: "INIT_START",
  INIT_END: "INIT_END",
  PAUSE_PLAYBACK: "PAUSE_PLAYBACK",
  RESUME_PLAYBACK: "RESUME_PLAYBACK",
  AD_START: "AD_START",
  AD_END: "AD_END",
  AD_CLICKED: "AD_CLICKED"
};
