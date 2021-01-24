BM.Control.Measure = BM.Control.extend({
  options: {
    position: 'topleft',
    //  weather to use keyboard control for this plugin
    keyboard: true,
    //  shortcut to activate measure
    activeKeyCode: 'M'.charCodeAt(0),
    //  shortcut to cancel measure, defaults to 'Esc'
    cancelKeyCode: 27,
    //  line color
    lineColor: 'black',
    //  line weight
    lineWeight: 2,
    //  line dash
    lineDashArray: '6, 6',
    //  line opacity
    lineOpacity: 1,
    //  format distance method
    formatDistance: null,
    //  define text color
    textColor: 'black'
  },

  initialize: function (options) {
    //  apply options to instance
    BM.Util.setOptions(this, options)
  },

  onAdd: function (map) {
    var className = 'bigemap-control-zoom bigemap-bar bigemap-control'
    var container = BM.DomUtil.create('div', className);
    var ruler='<svg t="1555989242157" class="icon" style="" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1104" xmlns:xlink="http://www.w3.org/1999/xlink" width="25" height="25"><defs><style type="text/css"></style></defs><path d="M942.257152 285.452288L738.547712 81.742848c-13.422592-13.422592-35.158016-13.411328-48.56832 0L81.743872 689.980416c-13.411328 13.410304-13.422592 35.144704 0 48.567296l203.70944 203.70944c13.421568 13.422592 35.156992 13.411328 48.567296 0l608.236544-608.237568c13.412352-13.40928 13.42464-35.144704 0.001024-48.567296zM309.736448 869.40672L154.594304 714.263552l39.058432-39.057408 99.971072 99.971072c13.422592 13.421568 35.156992 13.411328 48.56832 0 13.410304-13.411328 13.421568-35.145728 0-48.56832l-99.97312-99.971072 39.058432-39.057408 26.585088 26.584064c13.422592 13.422592 35.156992 13.411328 48.56832 0 13.410304-13.410304 13.421568-35.144704 0-48.56832l-26.585088-26.584064 39.057408-39.058432 99.971072 99.971072c13.422592 13.422592 35.158016 13.411328 48.56832 0 13.410304-13.410304 13.422592-35.144704 0-48.56832l-99.972096-99.971072 39.058432-39.058432 26.584064 26.585088c13.422592 13.421568 35.158016 13.411328 48.56832 0 13.410304-13.411328 13.422592-35.145728 0-48.56832l-26.585088-26.585088 39.058432-39.058432 99.971072 99.972096c13.421568 13.421568 35.156992 13.410304 48.567296 0 13.411328-13.411328 13.421568-35.145728 0-48.56832l-99.971072-99.971072 39.046144-39.047168 26.585088 26.585088c13.421568 13.423616 35.156992 13.411328 48.56832 0 13.410304-13.411328 13.421568-35.145728 0-48.56832l-26.585088-26.58304 33.923072-33.92512 155.143168 155.143168L309.736448 869.40672z" fill="" p-id="1105"></path></svg>';
    this._createButton(ruler, 'Measure',
    'bigemap-control-measure bigemap-bar-part bigemap-bar-part-top-and-bottom',
    container, this._toggleMeasure, this)
    if (this.options.keyboard) {
      BM.DomEvent.on(document, 'keydown', this._onKeyDown, this)
    }
    return container
  },
  onRemove: function (map) {
    if (this.options.keyboard) {
      BM.DomEvent.off(document, 'keydown', this._onKeyDown, this)
    }
  },

  _createButton: function (html, title, className, container, fn, context) {
    var link = BM.DomUtil.create('a', className, container)
    link.innerHTML = html
    link.href = '#'
    link.title = title

    BM.DomEvent
      .on(link, 'click', BM.DomEvent.stopPropagation)
      .on(link, 'click', BM.DomEvent.preventDefault)
      .on(link, 'click', fn, context)
      .on(link, 'dbclick', BM.DomEvent.stopPropagation)
    return link
  },

  _toggleMeasure: function () {
    this._measuring = !this._measuring
    if (this._measuring) {
      BM.DomUtil.addClass(this._container, 'bigemap-control-measure-on')
      this._startMeasuring()
    } else {
      BM.DomUtil.removeClass(this._container, 'bigemap-control-measure-on')
      this._stopMeasuring()
    }
  },

  _startMeasuring: function () {
    this._oldCursor = this._map._container.style.cursor
    this._map._container.style.cursor = 'crosshair'
    this._doubleClickZoom = this._map.doubleClickZoom.enabled()
    this._map.doubleClickZoom.disable()
    this._isRestarted = false

    BM.DomEvent
      .on(this._map, 'mousemove', this._mouseMove, this)
      .on(this._map, 'click', this._mouseClick, this)
      .on(this._map, 'dbclick', this._finishPath, this)

    if (!this._layerPaint) {
      this._layerPaint = BM.layerGroup().addTo(this._map)
    }

    if (!this._points) {
      this._points = []
    }
  },

  _stopMeasuring: function () {
    this._map._container.style.cursor = this._oldCursor
    BM.DomEvent
      .off(this._map, 'mousemove', this._mouseMove, this)
      .off(this._map, 'click', this._mouseClick, this)
      .off(this._map, 'dbclick', this._finishPath, this)

    if (this._doubleClickZoom) {
      this._map.doubleClickZoom.enabled()
    }
    if (this._layerPaint) {
      // this._layerPaint.clearLayers()
    }

    BM.DomUtil.removeClass(this._container, 'bigemap-control-measure-on');
    this._restartPath()
  },

  _mouseMove: function (e) {
    if (!e.latlng || !this._lastPoint) {
      return
    }
    if (!this._layerPaintPathTemp) {
      //  customize style
      this._layerPaintPathTemp = BM.polyline([this._lastPoint, e.latlng], {
        color: this.options.lineColor,
        weight: this.options.lineWeight,
        opacity: this.options.lineOpacity,
        clickable: false,
        dashArray: this.options.lineDashArray,
        interactive: false
      }).addTo(this._layerPaint)
    } else {
      //  replace the current layer to the newest draw points
      this._layerPaintPathTemp.getLatLngs().splice(0, 2, this._lastPoint, e.latlng)
      //  force path layer update
      this._layerPaintPathTemp.redraw()
    }

    //  tooltip
    if (this._tooltip) {
      if (!this._distance) {
        this._distance = 0
      }
      this._updateTooltipPosition(e.latlng)
      var distance = e.latlng.distanceTo(this._lastPoint)
      this._updateTooltipDistance(this._distance + distance, distance)
    }
  },

  _mouseClick: function (e) {
    if (!e.latlng) {
      return
    }

    if (this._isRestarted) {
      this._isRestarted = false
      return
    }

    if (this._lastPoint && this._tooltip) {
      if (!this._distance) {
        this._distance = 0
      }

      this._updateTooltipPosition(e.latlng)
      var distance = e.latlng.distanceTo(this._lastPoint)
      this._updateTooltipDistance(this._distance + distance, distance)

      this._distance += distance
    }

    this._createTooltip(e.latlng)

    //  main layer add to layerPaint
    if (this._lastPoint && !this._layerPaintPath) {
      this._layerPaintPath = BM.polyline([this._lastPoint], {
        color: this.options.lineColor,
        weight: this.options.lineWeight,
        opacity: this.options.lineOpacity,
        clickable: false,
        interactive: false
      }).addTo(this._layerPaint)
    }

    //  push current point to the main layer
    if (this._layerPaintPath) {
      this._layerPaintPath.addLatLng(e.latlng)
    }

    if (this._lastPoint) {
      if (this._lastCircle) {
        this._lastCircle.off('click', this._finishPath, this)
      }
      this._lastCircle = this._createCircle(e.latlng).addTo(this._layerPaint)
      this._lastCircle.on('click', this._finishPath, this)
    }
    this._lastPoint = e.latlng
  },

  _finishPath: function (e) {
    if (e) {
      BM.DomEvent.preventDefault(e)
    }
    if (this._tooltip) {
      //  when remove from map, the _icon property becomes null
      this._layerPaint.removeLayer(this._tooltip)
    }
    if (this._layerPaint && this._layerPaintPathTemp) {
      this._layerPaint.removeLayer(this._layerPaintPathTemp)
    }
    if (this._lastCircle) {
      this._lastCircle.off('click', this._finishPath, this).remove();
      let layerGroup=this._layerPaint;
      this._layerPaint=undefined;
      // BM.marker(this._lastCircle.getLatLng()).addTo(this._map);
      BM.marker(this._lastCircle.getLatLng(),{icon:BM.divIcon({iconSize:BM.point(14,14),iconAnchor:BM.point(7,7),html:'<span class="close">&chi;</span>',className:'bigemap-remove-current-data'})}).on('click',function () {
        layerGroup.clearLayers();
        this.remove();
      }).addTo(this._map);
      console.log(this._lastCircle);
    }
    //  clear everything
    this._toggleMeasure();
    this._restartPath()
  },

  _restartPath: function () {
    this._distance = 0
    this._lastCircle = undefined
    this._lastPoint = undefined
    this._tooltip = undefined
    this._layerPaintPath = undefined
    this._layerPaintPathTemp = undefined

    //  flag to stop propagation events...
    this._isRestarted = true
  },

  _createCircle: function (latlng) {
    return new BM.CircleMarker(latlng, {
      color: 'black',
      opacity: 1,
      weight: 1,
      fillColor: 'white',
      fill: true,
      fillOpacity: 1,
      radius: 4,
      clickable: Boolean(this._lastCircle)
    })
  },

  _createTooltip: function (position) {
    var icon = BM.divIcon({
      className: 'bigemap-measure-tooltip',
      iconAnchor: [-5, -5]
    })
    this._tooltip = BM.marker(position, {
      icon: icon,
      clickable: false
    }).addTo(this._layerPaint)
  },

  _updateTooltipPosition: function (position) {
    this._tooltip.setLatLng(position)
  },

  _updateTooltipDistance: function (total, difference) {
    if (!this._tooltip._icon) {
      return
    }
    var totalRound = this._formatDistance(total)
    var differenceRound = this._formatDistance(difference)
    var text = '<div class="bigemap-measure-tooltip-total" style="color:'+ this.options.textColor +'">' + totalRound + '</div>'
    if (differenceRound > 0 && totalRound !== differenceRound) {
      text += '<div class="bigemap-measure-tooltip-difference" style="color:'+ this.options.textColor +'">(+' + differenceRound + ')</div>'
    }
    this._tooltip._icon.innerHTML = text
  },
  _formatDistance: function (val) {
    if (typeof this.options.formatDistance === 'function') {
      return this.options.formatDistance(val);
    }
    if (val < 1000) {
      return Math.round(val) + 'm'
    } else {
      return Math.round((val / 1000) * 100) / 100 + 'km'
    }
  },

  _onKeyDown: function (e) {
    // key control
    switch (e.keyCode) {
      case this.options.activeKeyCode:
        if (!this._measuring) {
          this._toggleMeasure()
        }
        break
      case this.options.cancelKeyCode:
        //  if measuring, cancel measuring
        if (this._measuring) {
          if (!this._lastPoint) {
            this._toggleMeasure()
          } else {
            this._finishPath()
            this._isRestarted = false
          }
        }
        break
    }
  }
})

BM.control.measure = function (options) {
  return new BM.Control.Measure(options)
}

BM.Map.mergeOptions({
  measureControl: false
})

BM.Map.addInitHook(function () {
  if (this.options.measureControl) {
    this.measureControl = new BM.Control.Measure()
    this.addControl(this.measureControl)
  }
})
