/* ============================================
   UMRANIGPT - Model Manager
   ============================================ */
'use strict';

window.AppModels = (() => {
  const { emit, $ } = window.AppUtils;

  let models = [];
  let selectedModel = '';
  let isLoading = false;

  const init = async () => {
    const settings = AppStorage.getSettings();
    selectedModel = settings.lastModel || '';
    renderSelector();
  };

  /* ---- Fetch models from Ollama ---- */
  const refresh = async () => {
    if (isLoading) return;
    isLoading = true;
    setLoading(true);

    try {
      models = await OllamaService.listModels();
      renderOptions();

      if (models.length === 0) {
        setPlaceholder('No models found');
        return;
      }

      // Auto-select: keep current if still available, else pick first
      if (selectedModel && models.some(m => m.name === selectedModel)) {
        setSelected(selectedModel, false);
      } else if (models.length > 0) {
        setSelected(models[0].name, false);
      }

      emit('modelsLoaded', { models });
    } catch (err) {
      setPlaceholder('Failed to load models');
      console.error('Model refresh error:', err);
    } finally {
      isLoading = false;
      setLoading(false);
    }
  };

  /* ---- DOM ---- */
  const renderSelector = () => {
    const btn = $('#model-selector-btn');
    const dropdown = $('#model-dropdown');
    if (!btn || !dropdown) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleDropdown();
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#model-selector-btn') && !e.target.closest('#model-dropdown')) {
        closeDropdown();
      }
    });
  };

  const renderOptions = () => {
    const dropdown = $('#model-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '';

    if (models.length === 0) {
      dropdown.innerHTML = `
        <div class="model-dropdown-loading">
          <i class="fa-solid fa-inbox" style="font-size:18px;opacity:0.4;"></i>
          <span>No models installed</span>
        </div>`;
      return;
    }

    // Group by family
    const families = {};
    models.forEach(m => {
      const family = m.family || getModelFamily(m.name);
      if (!families[family]) families[family] = [];
      families[family].push(m);
    });

    Object.entries(families).forEach(([family, fModels]) => {
      if (Object.keys(families).length > 1) {
        const label = document.createElement('div');
        label.style.cssText = 'padding:4px 10px 2px;font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.08em;font-weight:600;';
        label.textContent = family;
        dropdown.appendChild(label);
      }

      fModels.forEach(model => {
        const item = document.createElement('div');
        item.className = `model-dropdown-item ${model.name === selectedModel ? 'selected' : ''}`;
        item.dataset.model = model.name;
        item.innerHTML = `
          <i class="fa-solid fa-microchip" style="font-size:11px;"></i>
          <span class="model-item-name">${window.AppUtils.escapeHtml(model.name)}</span>
          ${model.parameterSize ? `<span class="model-item-size">${model.parameterSize}</span>` : ''}
        `;
        item.addEventListener('click', () => {
          setSelected(model.name);
          closeDropdown();
        });
        dropdown.appendChild(item);
      });
    });
  };

  const setLoading = (state) => {
    const btn = $('#model-selector-btn');
    const nameEl = btn?.querySelector('.model-name');
    if (!nameEl) return;
    if (state) {
      nameEl.innerHTML = '<span style="display:flex;align-items:center;gap:6px;"><span class="spinner spinner-sm"></span> Loading...</span>';
    }
  };

  const setPlaceholder = (text) => {
    const btn = $('#model-selector-btn');
    const nameEl = btn?.querySelector('.model-name');
    if (nameEl) nameEl.textContent = text;
  };

  const setSelected = (name, notify = true) => {
    selectedModel = name;
    AppStorage.updateSetting('lastModel', name);

    const btn = $('#model-selector-btn');
    const nameEl = btn?.querySelector('.model-name');
    if (nameEl) nameEl.textContent = getDisplayName(name);

    // Update dropdown selection highlight
    const dropdown = $('#model-dropdown');
    if (dropdown) {
      dropdown.querySelectorAll('.model-dropdown-item').forEach(item => {
        item.classList.toggle('selected', item.dataset.model === name);
      });
    }

    if (notify) emit('modelChanged', { model: name });
  };

  const toggleDropdown = () => {
    const dropdown = $('#model-dropdown');
    const btn = $('#model-selector-btn');
    if (!dropdown) return;

    const isOpen = dropdown.classList.contains('open');
    if (isOpen) {
      closeDropdown();
    } else {
      dropdown.classList.add('open');
      btn?.classList.add('open');
    }
  };

  const closeDropdown = () => {
    const dropdown = $('#model-dropdown');
    const btn = $('#model-selector-btn');
    dropdown?.classList.remove('open');
    btn?.classList.remove('open');
  };

  /* ---- Helpers ---- */
  const getDisplayName = (name) => {
    if (!name) return 'Select Model';
    // Clean up common suffixes
    return name.replace(/:latest$/, '').split('/').pop();
  };

  const getModelFamily = (name) => {
    const n = name.toLowerCase();
    if (n.includes('llama')) return 'LLaMA';
    if (n.includes('mistral') || n.includes('mixtral')) return 'Mistral';
    if (n.includes('gemma')) return 'Gemma';
    if (n.includes('qwen')) return 'Qwen';
    if (n.includes('phi')) return 'Phi';
    if (n.includes('deepseek')) return 'DeepSeek';
    if (n.includes('vicuna') || n.includes('alpaca')) return 'Fine-tuned';
    if (n.includes('code')) return 'Code';
    if (n.includes('vision') || n.includes('llava')) return 'Vision';
    return 'Other';
  };

  const getSelected = () => selectedModel;
  const getModels = () => models;
  const isMultimodal = (name) => {
    const n = (name || selectedModel).toLowerCase();
    return n.includes('vision') || n.includes('llava') || n.includes('bakllava') || n.includes('moondream');
  };

  return {
    init, refresh,
    getSelected, getModels, setSelected,
    getDisplayName, getModelFamily, isMultimodal,
  };
})();
