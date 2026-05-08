function Marquee(selector, speed) {
  const container =
    typeof selector === "string" ? document.querySelector(selector) : selector;

  if (!container) return;

  // Дублируем контент
  const originalContent = container.innerHTML;
  container.insertAdjacentHTML("beforeend", originalContent);

  let position = 0;
  let animationFrameId = null;
  let isAnimating = false;
  let widthReady = false;

  function animate() {
    if (!isAnimating) return;

    position -= speed;
    const originalWidth = container.scrollWidth / 2;

    if (Math.abs(position) >= originalWidth) {
      position = 0;
    }

    container.style.transform = `translateX(${position}px)`;
    animationFrameId = requestAnimationFrame(animate);
  }

  function start() {
    if (isAnimating) return;
    // Не запускаем, если ширина ещё не определена
    if (!widthReady && container.scrollWidth === 0) {
      waitForWidth();
      return;
    }
    isAnimating = true;
    animate();
  }

  function stop() {
    if (!isAnimating) return;
    isAnimating = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }

  // Ждём, пока у контейнера появится ненулевая ширина
  function waitForWidth() {
    if (container.scrollWidth > 0) {
      widthReady = true;
      start();
    } else {
      setTimeout(waitForWidth, 100);
    }
  }

  container.addEventListener("mouseenter", stop);
  container.addEventListener("mouseleave", start);

  window.addEventListener("resize", () => {
    stop();
    // При ресайзе ширина может временно стать 0 – ждём восстановления
    widthReady = false;
    setTimeout(() => waitForWidth(), 100);
  });

  // Запускаем процесс: ждём готовности ширины, затем стартуем
  waitForWidth();
}

class Slider {
  constructor(element, userOptions = {}) {
    this.el =
      typeof element === "string" ? document.querySelector(element) : element;
    if (!this.el) throw new Error("Элемент слайдера не найден");

    this.wrapper = this.el.querySelector(".slider-wrapper");
    this.container = this.el.querySelector(".slider-container");
    this.prevBtn = this.el.querySelector(".slider-prev");
    this.nextBtn = this.el.querySelector(".slider-next");
    this.paginationContainer = this.el.querySelector(".slider-pagination");
    this.counterContainer = this.el.querySelector(".slider-counter"); // Новое

    if (!this.wrapper) throw new Error("Отсутствует .slider-wrapper");
    if (!this.container) throw new Error("Отсутствует .slider-container");

    this.slides = Array.from(this.wrapper.children).filter(
      (child) => child.classList && child.classList.contains("slide"),
    );
    this.totalSlides = this.slides.length;

    this.currentIndex = 0;
    this.slidesPerView = 1;
    this.gap = 0;
    this.slideWidth = 0;
    this.isSliderActive = true;
    this.resizeDebounceTimer = null;
    this.breakpoints = {};
    this.defaultSlidesPerView = 1;
    this.initBreakpoint = null;
    this.isNavigationEnabled = true;
    this.isPaginationEnabled = true;
    this.isCounterEnabled = false; // Новое
    this.startIndex = 0;

    // Drag/swipe
    this.isDragging = false;
    this.startX = 0;
    this.startOffset = 0;
    this.currentTranslate = 0;
    this.dragThreshold = 30;
    this.dragLock = false;
    this._eventsBound = false;

    this.options = this._mergeOptions(userOptions);
    this._applyOptions();
    this._extractBreakpoints();

    this._init();
  }

  _mergeOptions(userOptions) {
    const data = this.el.dataset;
    const fromData = {
      navigation:
        data.sliderNav !== undefined ? data.sliderNav === "true" : true,
      pagination:
        data.sliderPagination !== undefined
          ? data.sliderPagination === "true"
          : true,
      counter: data.sliderCounter === "true", // Новое
      initIndex: data.sliderInitIndex ? parseInt(data.sliderInitIndex, 10) : 0,
      defaultSlidesPerView: data.sliderDefaultView
        ? parseInt(data.sliderDefaultView, 10)
        : 1,
      breakpoints: data.sliderBreakpoints
        ? this._safeParseJSON(data.sliderBreakpoints)
        : {},
      initBreakpoint: data.sliderInitBreakpoint
        ? parseInt(data.sliderInitBreakpoint, 10)
        : null,
    };
    return { ...fromData, ...userOptions };
  }

  _safeParseJSON(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return {};
    }
  }

  _applyOptions() {
    this.isNavigationEnabled = this.options.navigation;
    this.isPaginationEnabled = this.options.pagination;
    this.isCounterEnabled = this.options.counter === true;
    this.startIndex = Math.min(
      Math.max(0, this.options.initIndex),
      this.totalSlides - 1,
    );
    this.defaultSlidesPerView = this.options.defaultSlidesPerView;
    this.breakpoints = this.options.breakpoints || {};
    this.initBreakpoint =
      this.options.initBreakpoint !== undefined
        ? this.options.initBreakpoint
        : null;

    this.el.setAttribute(
      "data-slider-nav",
      this.isNavigationEnabled ? "true" : "false",
    );
    this.el.setAttribute(
      "data-slider-pagination",
      this.isPaginationEnabled ? "true" : "false",
    );
    this.el.setAttribute(
      "data-slider-counter",
      this.isCounterEnabled ? "true" : "false",
    );

    // Если включён счётчик – скрываем пагинацию
    if (this.isCounterEnabled && this.paginationContainer) {
      this.paginationContainer.style.display = "none";
    } else if (this.paginationContainer) {
      this.paginationContainer.style.display = "";
    }
  }

  _extractBreakpoints() {
    const entries = Object.entries(this.breakpoints).map(([w, v]) => ({
      width: parseInt(w, 10),
      value: v,
    }));
    entries.sort((a, b) => a.width - b.width);
    this.sortedBreakpoints = entries;
  }

  _getSlidesPerViewForWidth(windowWidth) {
    let selected = this.defaultSlidesPerView;
    for (let bp of this.sortedBreakpoints) {
      if (windowWidth >= bp.width)
        selected =
          bp.value.slidesPerView !== undefined
            ? bp.value.slidesPerView
            : selected;
      else break;
    }
    return Math.min(Math.max(1, selected), this.totalSlides);
  }

  _checkActiveStatus(windowWidth) {
    const shouldBeActive =
      this.initBreakpoint === null || windowWidth < this.initBreakpoint;
    if (shouldBeActive && !this.isSliderActive) {
      this.isSliderActive = true;
      this._activateSliderMode();
    } else if (!shouldBeActive && this.isSliderActive) {
      this.isSliderActive = false;
      this._deactivateSliderMode();
    }
    return this.isSliderActive;
  }

  _deactivateSliderMode() {
    if (this.container) this.container.style.overflow = "";
    if (this.wrapper) {
      this.wrapper.style.transform = "";
      this.wrapper.style.flexWrap = "";
      this.wrapper.style.gap = "";
      this.wrapper.style.transition = "";
    }
    if (this.prevBtn && this.nextBtn) {
      this.prevBtn.style.display = "";
      this.nextBtn.style.display = "";
    }
    if (this.paginationContainer) this.paginationContainer.style.display = "";
    if (this.counterContainer) this.counterContainer.style.display = "";
    this.slides.forEach((slide) => {
      slide.style.width = "";
      slide.style.flex = "";
    });
    this._removeDragListeners();
    this.isDragging = false;
    this.el.setAttribute("data-slider-active", "false");
  }

  _activateSliderMode() {
    if (this.container) this.container.style.overflow = "hidden";
    if (this.wrapper) {
      this.wrapper.style.flexWrap = "nowrap";
    }
    if (this.prevBtn && this.nextBtn) {
      this.prevBtn.style.display = "";
      this.nextBtn.style.display = "";
    }
    if (
      this.paginationContainer &&
      this.isPaginationEnabled &&
      !this.isCounterEnabled
    ) {
      this.paginationContainer.style.display = "";
    } else if (this.paginationContainer) {
      this.paginationContainer.style.display = "none";
    }
    if (this.counterContainer && this.isCounterEnabled) {
      this.counterContainer.style.display = "";
    } else if (this.counterContainer) {
      this.counterContainer.style.display = "none";
    }

    this._setDimensions();
    this._updatePagination();
    this._updateNavigationState();

    const maxPossibleIndex = this.totalSlides - this.slidesPerView;
    let correctedIndex = Math.min(
      this.currentIndex,
      maxPossibleIndex >= 0 ? maxPossibleIndex : 0,
    );
    correctedIndex = Math.max(0, correctedIndex);
    if (correctedIndex !== this.currentIndex)
      this.currentIndex = correctedIndex;
    this._goTo(this.currentIndex, false);
    this._bindDragEvents();
    this.el.setAttribute("data-slider-active", "true");

    // Гарантируем, что обработчики кнопок навешаны и счётчик обновлён
    this._bindEvents();
    if (this.isCounterEnabled) this._updateCounter();
  }

  _getGap() {
    if (!this.wrapper) return 0;
    const style = window.getComputedStyle(this.wrapper);
    const gapVal = style.gap;
    return gapVal && gapVal !== "normal" ? parseFloat(gapVal) : 0;
  }

  _setDimensions() {
    if (!this.isSliderActive) return;
    const rect = this.container.getBoundingClientRect();
    let containerWidth = rect.width;
    if (containerWidth <= 0) {
      setTimeout(() => this._setDimensions(), 50);
      return;
    }
    this.gap = this._getGap();
    const totalGap = this.gap * (this.slidesPerView - 1);
    let newWidth = (containerWidth - totalGap) / this.slidesPerView;
    newWidth = Math.max(newWidth, 20);
    this.slideWidth = newWidth;

    this.slides.forEach((slide) => {
      slide.style.width = `${this.slideWidth}px`;
      slide.style.flex = `0 0 ${this.slideWidth}px`;
    });
  }

  // Обновление пагинации (точек) или счётчика
  _updatePagination() {
    if (this.isCounterEnabled) {
      this._updateCounter();
      return;
    }
    if (
      !this.isSliderActive ||
      !this.isPaginationEnabled ||
      !this.paginationContainer
    )
      return;
    const pages = Math.max(1, this.totalSlides - this.slidesPerView + 1);
    const existingDots = this.paginationContainer.children;
    if (existingDots.length !== pages) {
      this.paginationContainer.innerHTML = "";
      for (let i = 0; i < pages; i++) {
        const dot = document.createElement("button");
        dot.classList.add("dot");
        dot.setAttribute("data-index", i);
        dot.addEventListener("click", (e) => {
          e.stopPropagation();
          if (this.isSliderActive && !this.isDragging) this._goTo(i, true);
        });
        this.paginationContainer.appendChild(dot);
      }
    }
    this._setActiveDot();
  }

  // Обновление активной точки (при пагинации)
  _setActiveDot() {
    if (this.isCounterEnabled) {
      this._updateCounter();
      return;
    }
    if (
      !this.isSliderActive ||
      !this.isPaginationEnabled ||
      !this.paginationContainer
    )
      return;
    const dots = this.paginationContainer.querySelectorAll(".dot");
    dots.forEach((dot, idx) => {
      if (idx === this.currentIndex) dot.classList.add("active");
      else dot.classList.remove("active");
    });
  }

  // Обновление текстового счётчика
  _updateCounter() {
    if (
      !this.isSliderActive ||
      !this.isCounterEnabled ||
      !this.counterContainer
    )
      return;
    const pages = Math.max(1, this.totalSlides - this.slidesPerView + 1);
    const currentPage = this.currentIndex + 1;
    this.counterContainer.textContent = `${currentPage} / ${pages}`;
  }

  _updateNavigationState() {
    if (!this.isSliderActive) return;
    if (this.prevBtn && this.nextBtn) {
      const maxIdx = this.totalSlides - this.slidesPerView;
      const isPrevDisabled = this.currentIndex <= 0;
      const isNextDisabled = this.currentIndex >= maxIdx || maxIdx <= 0;
      this.prevBtn.disabled = isPrevDisabled;
      this.nextBtn.disabled = isNextDisabled;
      if (isPrevDisabled) this.prevBtn.setAttribute("disabled", "disabled");
      else this.prevBtn.removeAttribute("disabled");
      if (isNextDisabled) this.nextBtn.setAttribute("disabled", "disabled");
      else this.nextBtn.removeAttribute("disabled");
    }
  }

  _goTo(index, withEvent = true) {
    if (!this.isSliderActive) return;
    const maxIdx = Math.max(0, this.totalSlides - this.slidesPerView);
    const target = Math.min(maxIdx, Math.max(0, index));
    this.currentIndex = target;
    const offset = -(this.currentIndex * (this.slideWidth + this.gap));
    this.wrapper.style.transform = `translateX(${offset}px)`;
    this._setActiveDot(); // обновит либо точку, либо счётчик
    this._updateNavigationState();
    if (withEvent) {
      this.el.dispatchEvent(
        new CustomEvent("slider:change", {
          detail: { index: this.currentIndex },
        }),
      );
    }
  }

  // Drag & Swipe
  _bindDragEvents() {
    this._removeDragListeners();

    if (!this.container) return;
    this.container.addEventListener("touchstart", this._onDragStart, {
      passive: false,
    });
    this.container.addEventListener("touchmove", this._onDragMove, {
      passive: false,
    });
    this.container.addEventListener("touchend", this._onDragEnd);
    this.container.addEventListener("mousedown", this._onDragStart);
    window.addEventListener("mousemove", this._onDragMove);
    window.addEventListener("mouseup", this._onDragEnd);
    this._dragBound = {
      start: this._onDragStart.bind(this),
      move: this._onDragMove.bind(this),
      end: this._onDragEnd.bind(this),
    };
  }

  _removeDragListeners() {
    if (!this.container) return;
    this.container.removeEventListener("touchstart", this._dragBound?.start);
    this.container.removeEventListener("touchmove", this._dragBound?.move);
    this.container.removeEventListener("touchend", this._dragBound?.end);
    this.container.removeEventListener("mousedown", this._dragBound?.start);
    window.removeEventListener("mousemove", this._dragBound?.move);
    window.removeEventListener("mouseup", this._dragBound?.end);
  }

  _onDragStart = (e) => {
    if (!this.isSliderActive || this.totalSlides <= this.slidesPerView) return;
    const target = e.target;
    if (
      target.closest(".slider-prev") ||
      target.closest(".slider-next") ||
      target.closest(".dot")
    )
      return;
    this.isDragging = true;
    this.dragLock = false;
    const clientX = e.type.startsWith("touch")
      ? e.touches[0].clientX
      : e.clientX;
    this.startX = clientX;
    const transform = this.wrapper.style.transform;
    const match = transform.match(/translateX\(([-\d.]+)px\)/);
    this.startOffset = match ? parseFloat(match[1]) : 0;
    this.currentTranslate = this.startOffset;
    this.wrapper.style.transition = "none";
    e.preventDefault();
  };

  _onDragMove = (e) => {
    if (!this.isDragging || !this.isSliderActive) return;
    const clientX = e.type.startsWith("touch")
      ? e.touches[0].clientX
      : e.clientX;
    const delta = clientX - this.startX;
    let newTranslate = this.startOffset + delta;
    const minTranslate =
      -(this.totalSlides - this.slidesPerView) * (this.slideWidth + this.gap);
    const maxTranslate = 0;
    newTranslate = Math.min(maxTranslate, Math.max(minTranslate, newTranslate));
    this.currentTranslate = newTranslate;
    this.wrapper.style.transform = `translateX(${newTranslate}px)`;
    e.preventDefault();
  };

  _onDragEnd = () => {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.wrapper.style.transition = "";
    const delta = this.currentTranslate - this.startOffset;
    if (Math.abs(delta) > this.dragThreshold && !this.dragLock) {
      if (delta > 0) this.prev();
      else if (delta < 0) this.next();
      this.dragLock = true;
      setTimeout(() => {
        this.dragLock = false;
      }, 200);
    } else {
      this._goTo(this.currentIndex, false);
    }
  };

  next() {
    if (!this.isSliderActive) return;
    const maxIdx = this.totalSlides - this.slidesPerView;
    if (this.currentIndex < maxIdx) this._goTo(this.currentIndex + 1, true);
  }
  prev() {
    if (!this.isSliderActive) return;
    if (this.currentIndex > 0) this._goTo(this.currentIndex - 1, true);
  }

  _handleResize = () => {
    const w = window.innerWidth;
    const wasActive = this.isSliderActive;

    // Проверяем, нужно ли изменить состояние (активен/неактивен)
    this._checkActiveStatus(w);

    // Если состояние изменилось с неактивного на активное – выполняем полную переинициализацию
    if (this.isSliderActive && !wasActive) {
      // Даём браузеру время завершить перерисовку после смены CSS-классов
      setTimeout(() => {
        // Заново определяем количество видимых слайдов
        this.slidesPerView = this._getSlidesPerViewForWidth(window.innerWidth);
        this._setDimensions();
        const maxValid = Math.max(0, this.totalSlides - this.slidesPerView);
        let corrected = Math.min(this.currentIndex, maxValid);
        corrected = Math.max(0, corrected);
        if (corrected !== this.currentIndex) this.currentIndex = corrected;
        this._goTo(this.currentIndex, false);
        this._updatePagination(); // пересоздаст пагинацию/счётчик
        this._updateNavigationState(); // обновит состояние кнопок
        if (this.isCounterEnabled) this._updateCounter();
      }, 20);
      return;
    }

    // Если слайдер активен – обрабатываем ресайз обычным способом
    if (this.isSliderActive) {
      const newSPV = this._getSlidesPerViewForWidth(w);
      if (newSPV !== this.slidesPerView) {
        this.slidesPerView = newSPV;
        this._setDimensions();
        const maxValid = Math.max(0, this.totalSlides - this.slidesPerView);
        let corrected = Math.min(this.currentIndex, maxValid);
        corrected = Math.max(0, corrected);
        if (corrected !== this.currentIndex) this.currentIndex = corrected;
        this._goTo(this.currentIndex, false);
        this._updatePagination();
      } else {
        this._setDimensions();
        this._goTo(this.currentIndex, false);
      }
      this._updateNavigationState();
      if (this.isCounterEnabled) this._updateCounter();
    }
  };

  _bindEvents() {
    if (this._eventsBound) return;
    if (this.prevBtn) {
      this.prevBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.prev();
      });
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.next();
      });
    }
    window.addEventListener("resize", () => {
      clearTimeout(this.resizeDebounceTimer);
      this.resizeDebounceTimer = setTimeout(() => this._handleResize(), 120);
    });
    this._eventsBound = true;
  }

  _init() {
    const winWidth = window.innerWidth;
    this.isSliderActive =
      this.initBreakpoint === null || winWidth < this.initBreakpoint;
    if (!this.isSliderActive) {
      this._deactivateSliderMode();
      return;
    }
    this.slidesPerView = this._getSlidesPerViewForWidth(winWidth);
    this._activateSliderMode();
    this.currentIndex = Math.min(
      this.startIndex,
      Math.max(0, this.totalSlides - this.slidesPerView),
    );
    this._goTo(this.currentIndex, false);
    setTimeout(() => this._handleResize(), 100);
    if (window.ResizeObserver) {
      this._resizeObserver = new ResizeObserver(() => this._handleResize());
      this._resizeObserver.observe(this.container);
    }
  }

  destroy() {
    this._removeDragListeners();
    window.removeEventListener("resize", this._handleResize);
    if (this._resizeObserver) this._resizeObserver.disconnect();
    if (this.wrapper) this.wrapper.style.cssText = "";
    if (this.container) this.container.style.overflow = "";
    this.slides.forEach((s) => (s.style.cssText = ""));
  }
}

// Инициализация всех слайдеров с классом .slider
document.addEventListener("DOMContentLoaded", () => {
  const sliderElements = document.querySelectorAll(".slider");
  sliderElements.forEach((sliderElement) => {
    if (sliderElement && !sliderElement.sliderInstance) {
      sliderElement.sliderInstance = new Slider(sliderElement);
    }
  });
});

window.addEventListener("load", () => {
  const marqueeElements = document.querySelectorAll(".marquee .marquee-inner");
  marqueeElements.forEach((elem) => Marquee(elem, 0.6));
});
