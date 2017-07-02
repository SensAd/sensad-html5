// Copyright 2017, SensAd

var SensAd = function (apiKey, consumerEmail, videoId, videoZIndex) {

  if (!videoId) {
    return undefined;
  }

  var videoElement = document.getElementById(videoId);
  var videoContainerElement = videoElement.parentElement;

  if (!videoElement || !videoContainerElement) {
    return undefined;
  }

  var inMillis = 500;
  var outMillis = 400;

  var K4W = 3840;  /* UHD 4K width */
  var K4H = 2160;  /* UHD 4K height */

  var stopped = false;
  var timeoutRefs = [];
  var vmap;
  var currentAd;
  var currentXd;

  var _address = arguments[4];
  var _slowAnimations = arguments[5] ? 10 : 1;
  var _debug = arguments[6];
  var _customHandler = arguments[7];

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
    if (0 != url.indexOf("http")) {
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
            case "tall": ad.tall = true; break;
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

  var Style = function (ad, node) {
    var stack;
    if (node === videoElement) {
      stack = [];
    } else {
      stack = ["position:absolute", "background-image:url('" + ad.imgUrl + "')", "background-position:" + (ad.left ? "left" : "right"), "background-repeat:no-repeat"];
      if (ad.expander) {
        stack.push("background-size:auto 100%");
        stack.push("background-clip:content-box");
        stack.push("padding-right:60px");
      } else {
        stack.push("background-size:cover");
      }
    }
    this.style = function () {
      var result = stack.join(";") + ";";
      return result;
    }
    this.zIndex = function () {
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
        stack.push(ad.left ? "right:0%" : "left:0%");
        stack.push("top:0%");
      } else {
        if (ad.expander) {
          stack.push(ad.left ? (`left:calc(-${rationaleW(ad.expandedWidth || ad.width)}% - 60px)`) : (`right:calc(-${rationaleW(ad.expandedWidth || ad.width)}% - 60px)`));
          stack.push("bottom:5%");
        } else {
          stack.push(ad.left ? (`left:-${rationaleW(ad.expandedWidth || ad.width)}%`) : (`right:-${rationaleW(ad.expandedWidth || ad.width)}%`));
          stack.push("bottom:0");
        }
      }
      return this;
    };
    this.inOrigin = function () {
      if (ad.free) {
        stack.push(freeIsLefty(ad) ? (`left:${rationaleW(ad.left)}%`) : (`right:${rationaleW(K4W - ad.left - ad.width)}%`));
        stack.push(`bottom:${rationaleH(K4H - ad.top - ad.height)}%`);
      } else if (ad.singledecorator || ad.doubledecorator) {
        stack.push(ad.left ? "right:0%" : "left:0%");
        stack.push("top:0%");
      } else {
        stack.push(ad.left ? "left:0%" : "right:0%");
        if (ad.expander) {
          stack.push("bottom:5%");
        } else {
          stack.push("bottom:0");
        }
      }
      return this;
    };
    this.collapsedOutOrigin = function () {
      if (ad.singledecorator || ad.doubledecorator) {
        stack.push(ad.left ? "right:0%" : "left:0%");
        stack.push("top:0%");
      } else {
        if (ad.expander) {
          stack.push(ad.left ? (`left:calc(-${rationaleW(ad.width)}% - 60px)`) : (`right:calc(-${rationaleW(ad.width)}% - 60px)`));
          stack.push("bottom:5%");
        } else {
          stack.push(ad.left ? (`left:-${rationaleW(ad.width)}%`) : (`right:-${rationaleW(ad.width)}%`));
          stack.push("bottom:0");
        }
      }
      return this;
    };
    this.outSize = function () {
      if (ad.expander) {
        stack.push(`width:calc(${rationaleW(ad.expandedWidth)}% + 60px)`);
      } else {
        stack.push(`width:${rationaleW(ad.expandedWidth || ad.width)}%`);
      }
      stack.push(`height:${rationaleH(ad.expandedHeight || ad.height)}%`);
      return this;
    };
    this.inSize = function () {
      if (ad.singledecorator) {
        stack.push(`width:80%`);
        stack.push(`height:80%`);
      } else if (ad.doubledecorator) {
        stack.push(`width:60%`);
        stack.push(`height:60%`);
      } else {
        if (ad.expander) {
          stack.push(`width:calc(${rationaleW(ad.expandedWidth)}% + 60px)`);
        } else {
          stack.push(`width:${rationaleW(ad.width)}%`);
        };
        
        stack.push(`height:${rationaleH(ad.expandedHeight || ad.height)}%`);
      }
      return this;
    };
    this.collapsedSize = function () {
      if (ad.expander) {
        stack.push(`width:calc(${rationaleW(ad.width)}% + 60px)`);
      } else {
        stack.push(`width:${rationaleW(ad.width)}%`);
      }
      stack.push(`height:${rationaleH(ad.height)}%`);
      return this;
    };
    this.animateIn = function (cb) {
      stack.push("transition-property:all",
        `transition-duration:${(inMillis / 1000) * _slowAnimations}s`,
        "transition-timing-function:ease-out");
      timeoutRefs.push(setTimeout(cb, inMillis * _slowAnimations));
      return this;
    };
    this.animateOut = function (cb) {
      stack.push("transition-property:all",
        `transition-duration:${(outMillis / 1000) * _slowAnimations}s`,
        "transition-timing-function:ease-out");
      timeoutRefs.push(setTimeout(cb, outMillis * _slowAnimations));
      return this;
    };
    return this;
  };

  var putIntoPosition = function (ad, xd) {
    xd.setAttribute("style", new Style(ad, xd).zIndex().outOrigin().outSize().style());
    setTimeout(function () {
      slideIn(ad, xd);
    }, 100);
  };

  var slideIn = function (ad, xd) {
    var node = (ad.singledecorator || ad.doubledecorator) ? videoElement : xd;

    node.setAttribute("style", new Style(ad, node).zIndex().inOrigin().inSize().animateIn(function () {
      if (ad.expander) {
        scheduleCollapse(ad, xd);
      } else {
        ad.timeoutRef = setTimeout(function () {
          slideOut(ad, node);
        }, ad.minDuration);
        timeoutRefs.push(ad.timeoutRef);
        // TODO: test 0 duration
      }
    }).style());
  };

  var slideOut = function (ad, node, cb) {

    disposeTimeoutRefs();
    if (ad.timeoutRef) {
      delete ad.timeoutRef;
    }

    var style = new Style(ad, node).zIndex();
    if (ad.expander && ad.collapsed) {
      style.collapsedOutOrigin().collapsedSize();
    } else {
      style.outOrigin().outSize();
    }
    node.setAttribute("style", style.animateOut(function () {
      ad.xd.remove();
      currentXd = undefined;
      currentAd = undefined;
      if (cb) {
        cb();
      }
    }).style());
  };

  var scheduleCollapse = function (ad, xd) {
    if (ad.timeoutRef) {
      clearTimeout(ad.timeoutRef);
      delete ad.timeoutRef;
    }
    ad.timeoutRef = setTimeout(function () {
      collapse(ad, xd, 0);
    }, 5000);
    timeoutRefs.push(ad.timeoutRef);
  };

  var scheduleSlideOut = function (ad, xd) {
    if (ad.timeoutRef) {
      clearTimeout(ad.timeoutRef);
      delete ad.timeoutRef;
    }
    var millisToSlideOut = Math.max(ad.minDuration - 5000, 5000);
    if (millisToSlideOut < 1) {
      // never auto-animate out, only on close;
      //return;
    }
    ad.timeoutRef = setTimeout(function () {
      slideOut(ad, xd);
    }, millisToSlideOut);
    timeoutRefs.push(ad.timeoutRef);
  };

  var collapse = function (ad, xd, manual, cb) {
    if (ad.collapsed) {
      if (cb) {
        cb();
      }
    }
    if (ad.timeoutRef) {
      clearTimeout(ad.timeoutRef);
      delete ad.timeoutRef;
    }
    xd.setAttribute("style", new Style(ad, xd).zIndex().inOrigin().collapsedSize().animateOut(function () {
      ad.collapsed = true;

      if (ad.expander && !ad.closeHandle) {
        ad.counter.remove();
        ad.closeHandle = document.createElement("div");
        xd.appendChild(ad.closeHandle);
        ad.closeHandle.setAttribute("style", `position:absolute;top:0;${ad.left ? "right:0" : "left:0"};width:60px;height:50%;background-color:rgba(81, 81, 81, 0.7);background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACwAAAAsCAYAAAAehFoBAAAABGdBTUEAALGPC/xhBQAAAl5JREFUWAnV2T9OwzAUBnDsqiBmBhBQurFUYq04AgdgRGLiXEiMHIAjoG4IqQtbVUAwMCNATdCX6kWuY8fPznMFHkjrP+/7NTRWm25stLTp6HyzZTjLUHLm/PB0+6F/dPW4NTzLInMURRYyke0YrrqUawALPt5fLlRZ7GNc9XqTk6/ZnWuuVB+w5WIxRr1S6ded3YObwfP9p12/AbaxtCAn2sRSng+9AvZhqUgOtAtLeS50DQ5hqYgkug1LeTa6AnOxVEQCzcFSnolW2EZ+niaXdIHRpNCxCzoGSw6g+8fjaz2a3n5rreY0wD3iikYwdz7NS8FiLYyw1u/h1EIxZ1oiowbjVUgURB1Xk6q9AkaQVGETLVmzAZZGS2Jhc4Kl0NLYVnBXNNbTZwM85rbQRew9wxSQcpZKpWaqLIdUg3sMYVEnCMakGHROLBvMRefGRoFD6HVgo8E+9LqwSWAbvU5sMpjQRVHs5doNkOFq2tXJ7UvB4j/Cre+ax9rW7IUx25y51nz7cPZccy09jgZLYOvwhG/jUWBJbCqaDc6BTUGzwDmxseggeB3YGHTrtpaKxQ6gtX4jCPfI+WLrPcNdsHQfTqKG/WKdYMkgyVrAN8DSAQiRrLkCliwMqNmkatdgqYIm0n4skVGBJQrZON/zrlkaNwOLohz4Anz9qR9esINgra+urx9GWKsz/K9ut9Ir4qJTzyzlmEfO28O8N4y19UWHJyG0JBZ5aG1oG4v5K2B0+NA5sMhDc6FdWMxtgNFpo3NikYdmon3Y5UzPX6D/4g+LHu6yO/ln1Naq7YOhzF+NJnMeXvjcogAAAABJRU5ErkJggg==);background-size:auto 30%;background-repeat:no-repeat;background-position:center;`);
        ad.closeHandle.addEventListener("click", function (e) {
          if (e.target === this) {
            disposeCurrentAd();
          }
        });
        ad.toggleHandle = document.createElement("div");
        xd.appendChild(ad.toggleHandle);
        ad.toggleHandle.setAttribute("style", `position:absolute;bottom:0;${ad.left ? "right:0" : "left:0"};width:60px;height:50%;background-color:rgba(81, 81, 81, 0.7);background-image:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEgAAAAsCAYAAADGiP4LAAAABGdBTUEAALGPC/xhBQAAAxNJREFUaAXd2kFy1DAQBdCYRQqOQFiw5QZZcAAqF8giVKpYcbEUm1yA4gi5AVsWwBFgxdB/6Da2LNndUksjj6qMPR61uvVmPHIKX1xUaIfD4bLCsKtD1sr5bDVrxptU6AsK+0D7m4zwrBDOhZzI7doGz9G4wHsa84rHfRqG4bNnjnAsxrnm8z9o/0A5f4X9cl+7AUVwpKZqSAGO5HNFcgFawZGi3ZESOJLPDakYSIEjRbshbeBIPhekIiADjhRdjKTEkXzFSNmrWAYOir6muHdSvXXPsfKDrAnHYnHPtWr6L/pkAWXiIPkf2r4tqtCfQCzGsLQiJPMlVojzSEvwV8vswr6U/w2du6XN+uFmXW4moFPjCFZLJDVQLzitkVRAveG0RNoE6hWnFdLqD13vOEDiH/1HOsxd3Z4LdmyfBNoDjkyoAOlAY7znucpws330EtsTznQ2VLflFuA7xb6kDV+S5C3AAmivOAKlRJriSGgUaQa0dxyZ6QZSDEdCF0gj0LngyEwTSGs4EjpDOgKdG47MNEDS4EjoiDScK47MlJHe0utXtCVXbek/2R+RLAGT2OM9Bz6RvTQrzjivnEsMN2Q/aUNSHBf/hU5jVGnBJWbJ8f8SkyjlpTbFkdAukTxwMMFxFcOLDaQYDsLQukLywsHEZkA4kUBaw0EYWhdInjiY1AIIJwMkDQ7C0E6K5I2DCUWB8AYj3dEhVjr8IGvbSZBq4GDCyWWe//v2E/VJIibEMOYtF5zo4nu6Fg6qTALhTUL6TbsH2rDsWVozpJo4mLDq20FF4KmJ6UMJWqyql1ttHDUQOvaG1ALHBNQTUiscM1APSC1xsoBOidQaB3NdXcXQIdb4FiB3dXsdG1N5DrHWmsc/PJU5Zt2sycbgTCQ8/vJlHMR4wLFPhrAiHORRLfNrBdHXXnsLUPxskNRBOW/oeOsxmGIc5CsGwiAKJDcc5EPbQHLBQR4XIC449U1yx0E+tASSGw5yuAFxwSFSNRzkQwuQXHH+ZXD+F5cbbR+5cOfR48MhF+fEB9R/o2IvW1dZK+dfOGD+CxzXrK0AAAAASUVORK5CYII=);background-size:auto 30%;background-repeat:no-repeat;background-position:center;`);
        ad.toggleHandle.addEventListener("click", function (e) {
          if (e.target === this) {
            ad.collapsed = ad.collapsed || false;
            if (ad.collapsed) {
              expand(ad, xd, 1);
            } else {
              collapse(ad, xd, 1);
            }
          }
        });
      }

      if (cb) {
        cb();
      } else {
        if (!manual) {
          scheduleSlideOut(ad, xd);
        }
      }
    }).style());
  };

  var expand = function (ad, xd) {
    if (!ad.collapsed) {
      return;
    }
    if (ad.timeoutRef) {
      clearTimeout(ad.timeoutRef);
      delete ad.timeoutRef;
    }
    xd.setAttribute("style", new Style(ad, xd).zIndex().inOrigin().inSize().animateIn(function () {
      ad.collapsed = false;
    }).style());
  };

  var showAd = function (ad) {

    if (!ad || !ad.type) {
      return;
    }


    
    disposeCurrentAd(function () {

      var xd = document.createElement("div");
      ad.xd = xd;

      currentAd = ad;
      currentXd = xd;

      if (ad.singledecorator || ad.doubledecorator) {
        videoContainerElement.insertBefore(xd, videoElement);
      } else {
        if (videoContainerElement.lastChild === videoElement) {
          videoContainerElement.appendChild(xd);
        } else {
          videoContainerElement.insertBefore(xd, videoElement.nextSibling);
        }
      }

      var onClick = function (e) {
        if (e.target === this) {
          xd.removeEventListener("click", onClick);
          fireEventListener("ad.click", ad);
          disposeCurrentAd(function () {
            fireEventListener("ad.disappear", ad);
          });
          if (_customHandler) {
            _customHandler(ad);
          } else {
            handleClick(ad);
          }
        }
      };

      var img = new Image();
      img.addEventListener("load", function () {
        putIntoPosition(ad, xd);

        if (ad.expander) {
          ad.counter = document.createElement("div");
          
          var spanContainer = document.createElement("div");
          spanContainer.setAttribute("style", "position:absolute;left:0;right:0;top:0;bottom:0;margin:auto;width:auto;height:40px;");
          ad.counter.appendChild(spanContainer);

          var numberSpan = document.createElement("span");
          numberSpan.setAttribute("style", `font-size:2.6vmax;font-weight:500;font-family:Arial, sans-serif;color:rgba(255, 255, 255, 0.7);width:60px;display:block;margin-top:-2px;`);
          numberText = document.createTextNode("5");
          numberSpan.appendChild(numberText);
          spanContainer.appendChild(numberSpan);

          var secSpan = document.createElement("span");
          secSpan.setAttribute("style", `font-size:2vmax;font-weight:500;font-family:Arial, sans-serif;color:rgba(255, 255, 255, 0.7);width:60px;display:block;`);
          secSpan.appendChild(document.createTextNode("sec"));
          spanContainer.appendChild(secSpan);

          xd.appendChild(ad.counter);
          ad.counter.setAttribute("style", `position:absolute;bottom:0;${ad.left ? "right:0" : "left:0"};width:60px;height:100%;background-color:rgba(81, 81, 81, 0.7);text-align:center;font-weight:500;font-family:Arial, sans-serif;color:rgba(255, 255, 255, 0.7);margin-top:auto;margin-bottom:auto;`);

          var counter = 4;
          var intervalRef = setInterval(function () {
            if (ad !== currentAd || counter < 0) {
              clearInterval(intervalRef);
              return;
            }
            numberText.nodeValue = counter--;
          }, 1000);
        }
      });
      xd.addEventListener("click", onClick);
      img.src = ad.imgUrl;
    });
  };

  this.startAdByTags = function (tags) {

    tags = tags.join(",");
    get("/xd/" + apiKey + "/t/" + encodeURIComponent(tags) + "/c/" + encodeURIComponent(consumerEmail), function (r, code) {
      if (200 === code) {
        var vast = parseVAST(r);
        showAd(vast);
      }
    });
  };

  var lastTimeString;

  var onTimeUpdated = function () {

    var timeString = timeCodeToString(parseInt(videoElement.currentTime));

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
  };

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
    for (var timeoutRef of timeoutRefs) {
      clearTimeout(timeoutRef);
    }
    timeoutRefs = [];
  };

  this.startAdByMediaId = function (mediaId, cb) {
    mediaId = encodeURIComponent(mediaId);
    get("/xd/" + apiKey + "/m/" + mediaId + "/c/" + encodeURIComponent(consumerEmail), function (r, code) {
      if (200 === code) {
        vmap = parseVMAP(r);
        videoElement.addEventListener("timeupdate", onTimeUpdated, true);
      }
      cb();
    });
  };

  this.stop = function () {
    stopped = true;
    videoElement.removeEventListener("timeupdate", onTimeUpdated, true);
    disposeTimeoutRefs();
    eventListeners = [];
  };

  var eventListeners = {};

  var fireEventListener = function (event, ad) {
    if (eventListeners[event]) {
      for (var cb of eventListeners[event]) {
        cb(ad);
      }
    }
  };

  this.addEventListener = function (event, cb) {
    if (!eventListeners[event]) {
      eventListeners[event] = [];
    }
    eventListeners[event].push(cb);
  };
};
