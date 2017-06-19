// Copyright 2017, SensAd

var SensAd = function (apiKey, consumerEmail, videoId, overlayId) {

  if (!overlayId || !videoId) {
    return;
  }

  var videoTag = document.getElementById(videoId);
  var overlayTag = document.getElementById(overlayId);

  if (!overlayTag || !videoTag) {
    return;
  }

  var K4W = 3840;  /* UHD 4K width */
  var K4H = 2160;  /* UHD 4K height */

  var stopped = false;
  var timeoutRefs = [];
  var vmap;

  var _address = arguments[4];
  var _debug = arguments[5];

  var get = function (url, cb) {
    if(0 != url.indexOf("http")) {
      url = (_address || "https://ad.sensad.net") + url;
    }
    var xhr = new XMLHttpRequest();
    xhr.addEventListener("load", function () {
      if (!stopped) {
        cb(this.responseText, xhr.status);
      }
    });
    xhr.addEventListener("error", function (e) {
      if (!stopped) {
        cb(this.responseText, xhr.status);
      }
    });
    xhr.open("GET", url);
    xhr.send();
  };

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
            case "thin": ad.thin = true; break;
            case "fat": ad.fat = true; break;
            case "custom": ad.custom = true; break;
          }
        }
        var side = nlNode.getAttribute("r:side");
        if (side && side.length) {
          ad.side = side;
          switch (ad.side) {
            case "left": ad.left = true; break;
            case "right": ad.right = true; break;
          }
        }
        if (ad.custom) {
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
      /*
      var trxIter = dom.evaluate('//v:Ad[@id="' + advertId + '"]/v:InLine/v:Creatives/v:Creative/v:NonLinearAds/v:TrackingEvents/v:Tracking', adNode, nsr);
      var trxNode = trxIter.iterateNext();
      while (trxNode) {


        trxNode = trxIter.iterateNext();
      }
      */

      adNode = adIter.iterateNext();
    }
  };

  var parseVMAP = function (xml) {
    var ads = {};
    var domParser = new DOMParser();
    var dom = domParser.parseFromString(xml, "text/xml");
    var nsr = dom.createNSResolver(dom);
    var abIter = dom.evaluate('//m:AdBreak', dom, nsr);
    var abNode = abIter.iterateNext();
    while (abNode) {
      var timeOffset = abNode.getAttribute("timeOffset");
      ads[timeOffset] = {};

      var vastIter = dom.evaluate('//m:AdBreak[@timeOffset="' + timeOffset + '"]/m:AdSource/m:VASTAdData/v:VAST', abNode, nsr);
      var vastNode = vastIter.iterateNext();
      while (vastNode) {
        parseVASTNode(dom, nsr, vastNode, ads[timeOffset]);
        vastNode = vastIter.iterateNext();
      }

      abNode = abIter.iterateNext();
    }
    return ads;
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

  var trackImpression = function (ad) {
    for (var url of ad.impressionUrls) {
      get(url);
    }
  };

  var handleClick = function (ad) {
    var toWeb = function () {
      if (ad.webUrl && ad.webUrl.length) {
        window.open(ad.webUrl + (-1 < ad.webUrl.indexOf("?") ? "&fb=1" : "?fb=1"));
      }
    }
    if (ad.pushUrl && ad.pushUrl.length) {
      get(ad.pushUrl, function(r, code) {
        if (404 === code) {
          toWeb();
        }
      });
    } else {
      toWeb();
    }
  };

  var rationale = function(size) {
    size = Number(size);
    if (isNaN(size)) {
      return;
    }
    var width = videoTag.offsetWidth;
    if (width <= 0) {
      return;
    }
    return (width / K4W) * size;
  };

  var customIsLefty = function (ad) {
    if (!ad.custom) {
      return undefined;
    }
    if (ad.left + (ad.width / 2) < (K4W / 2)) {
      return true;
    }
    return false;
  };

  var Style = function (ad) {
    var stack = ["background-image:url('" + ad.imgUrl + "')",
      "background-size:cover",
    "background-position:" + (ad.left ? "left" : "right"),
      "position:absolute"];
    this.style = function () {
      var result = stack.join(";") + ";";
      if (_debug) {
        console.log(JSON.stringify(stack));
      }
      return result;
    }
    this.initialSize = function () {
      stack.push("width:" + rationale(ad.expandedWidth || ad.width) + "px");
      stack.push("height:" + rationale(ad.expandedHeight || ad.height) + "px");
      return this;
    };
    this.collapsedSize = function () {
      stack.push("width:" + rationale(ad.width) + "px");
      stack.push("height:" + rationale(ad.height) + "px");
      return this;
    };
    this.initialOrigin = function () {
      if (ad.custom) {
        stack.push(customIsLefty(ad) ? ("left:-" + rationale(ad.width) + "px") : ("right:-" + rationale(ad.width) + "px"));
        stack.push("bottom:" + rationale(K4H - ad.top - ad.height) + "px");
        //stack.push("bottom:-" + rationale(ad.height) + "px");
        //stack.push("transform: scale(0.2)");
      } else {
        stack.push(ad.left ? ("left:-" + rationale(ad.width) + "px") : ("right:-" + rationale(ad.width) + "px"));
        stack.push("bottom:0");
      }
      return this;
    };
    this.finalOrigin = function () {
      if (ad.custom) {
        stack.push(customIsLefty(ad) ? ("left:" + rationale(ad.left) + "px") : ("right:" + rationale(K4W - ad.left - ad.width) + "px"));
        stack.push("bottom:" + rationale(K4H - ad.top - ad.height) + "px");
        //stack.push("transform: scale(1.0)");
      } else {
        stack.push(ad.left ? "left:0" : "right:0");
        stack.push("bottom:0");
      }
      return this;
    };
    this.translateIn = function (cb) {
      stack.push("transition-property:all",
        "transition-duration:0.3s",
        "transition-timing-function:ease-out");
      timeoutRefs.push(setTimeout(cb, 300));
      return this;
    };
    this.translateOut = function (cb) {
      stack.push("transition-property:all",
        "transition-duration:0.2s",
        "transition-timing-function:ease-out");
      timeoutRefs.push(setTimeout(cb, 200));
      return this;
    };
    return this;
  };

  var putIntoPosition = function (ad, xd) {
    var style = new Style(ad);
    xd.setAttribute("style", style.initialSize().initialOrigin().style());
    if (_debug) {
      console.log("IN position");
    }  
    slideIn(ad, xd, function () {

    });
  };

  var slideIn = function (ad, xd, cb) {
    if (_debug) {
      console.log("sliding IN");
    }  
    var style = new Style(ad);
    xd.setAttribute("style", style.initialSize().finalOrigin().translateIn(function () {
      ad.appeared = Date.now();
      if (_debug) {
        console.log("slid IN");
      }  
      if (ad.thin) {
        var remainingToCollapse = Math.min(ad.minDuration, 5000);
        if (_debug) {
          console.log("will collapse in " + (remainingToCollapse / 1000) + "s");
        }  
        ad.timeoutRef = setTimeout(function () {
          collapse(ad, xd, 0, function() {
            var elapsed = Date.now() - ad.appeared;
            var remainingDuration = ad.minDuration - elapsed;
            if (_debug) {
              console.log("will slide OUT in " + (remainingDuration / 1000) + "s");
            }  
            ad.timeoutRef = setTimeout(function () {
              slideOut(ad, xd);
            }, remainingDuration);
            timeoutRefs.push(ad.timeoutRef);
          });
        }, remainingToCollapse);
        timeoutRefs.push(ad.timeoutRef);
      } else {
        if (_debug) {
          console.log("will slide OUT in " + (ad.minDuration / 1000) + "s");
        }  
        ad.timeoutRef = setTimeout(function () {
          slideOut(ad, xd);
        }, ad.minDuration);
        timeoutRefs.push(ad.timeoutRef);
        // TODO: test 0 duration
      }
    }).style());
  };

  var slideOut = function (ad, xd) {
    if (_debug) {
      console.log("sliding OUT");
    }  
    var onCollapsed = function () {
      var style = new Style(ad);
      xd.setAttribute("style", style.collapsedSize().initialOrigin().translateOut(function () {
        if (_debug) {
          console.log("slid OUT");
        }  
        xd.remove();
      }).style());
    }
    if (ad.thin) {
      collapse(ad, xd, 0, function () {
        onCollapsed();
      });
    } else {
      onCollapsed();
    }
  };

  var collapse = function (ad, xd, manual, cb) {
    if (ad.collapsed) {
      if (_debug) {
        console.log("already collapsed");
      }  
      return cb();
    }
    if (_debug) {
      console.log("collapsing");
    }  
    var style = new Style(ad);
    xd.setAttribute("style", style.collapsedSize().finalOrigin().translateOut(function () {
      if (_debug) {
        console.log("collapsed");
      }  
      ad.collapsed = true;
      cb();
    }).style());
  };

  var expand = function (ad, xd, cb) {
    if (!ad.collapsed) {
      if (_debug) {
        console.log("already expanded");
      }  
      return cb();
    }
    if (_debug) {
      console.log("expanding");
    }  
    var style = new Style(ad);
    xd.setAttribute("style", style.initialSize().finalOrigin().translateIn(function () {
      if (_debug) {
        console.log("expanded");
      }  
      ad.collapsed = true;
      cb();
    }).style());
  };

  var clicked = function (ad, xd) {
    clearTimeout(ad.timeoutRef);
    delete ad.timeoutRef;
  }

  var showAd = function (ad) {

    if (!ad || !ad.type) {
      return;
    }

    var overlayNode = document.getElementById(overlayId);

    if (!overlayNode) {
      return;
    }

    var xd = document.createElement("div");

    // TODO: ad.forced, ad.hidden

    var onClick = function () {
      xd.removeEventListener("click", onClick);
      ad.clicked(ad, xd);
      handleClick(ad);
    };

    var img = new Image();
    img.addEventListener("load", function () {
      putIntoPosition(ad, xd);
    });
    xd.addEventListener("click", onClick);
    overlayNode.appendChild(xd);
    img.src = ad.imgUrl;
  };

  this.startAdByTags = function(tags) {

    tags = tags.join(",");
    tags = encodeURIComponent(tags);
    get("/xd/" + apiKey + "/t/" + encodeURIComponent(tags) + "/c/" + encodeURIComponent(consumerEmail), function(r, code) {
      if (200 === code) {
        var vast = parseVAST(r);
        showAd(vast);
      }
    });
  };

  var lastTimeString;

  var onTimeUpdated = function() {

    var timeString = timeCodeToString(parseInt(videoTag.currentTime));

    if (lastTimeString === timeString) {
      return;
    }
    lastTimeString = timeString;

    if (vmap) {
      var vast = vmap[timeString];
      if (vast) {
        showAd(vast);
      }
    }
  }

  this.startAdByMediaId = function(mediaId, cb) {
    mediaId = encodeURIComponent(mediaId);
    get("/xd/" + apiKey + "/m/" + mediaId + "/c/" + encodeURIComponent(consumerEmail), function(r, code) {
      if (200 === code) {
        vmap = parseVMAP(r);
        videoTag.addEventListener("timeupdate", onTimeUpdated, true);
      }
      cb();
    });
  };

  this.stop = function() {
    stopped = true;
    videoTag.removeEventListener("timeupdate", onTimeUpdated, true);
    for (var timeoutRef of timeoutRefs) {
      clearTimeout(timeoutRef);
    }
    timeoutRefs = [];
    if (_debug) {
      console.log("stopped");
    }  
  };
};
