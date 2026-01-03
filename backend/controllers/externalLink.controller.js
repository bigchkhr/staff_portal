const ExternalLink = require('../database/models/ExternalLink');
const User = require('../database/models/User');

class ExternalLinkController {
  // 獲取所有外部連結
  async getAllLinks(req, res) {
    try {
      const { search } = req.query;
      
      // 檢查是否為HR成員
      const isHRMember = await User.isHRMember(req.user.id);
      
      const options = {
        onlyActive: !isHRMember, // 非HR成員只能看到啟用的連結，HR成員可以看到所有連結
        search: search || null
      };

      const links = await ExternalLink.findAll(options);

      res.json({ links });
    } catch (error) {
      console.error('Get external links error:', error);
      res.status(500).json({ message: '獲取外部連結列表時發生錯誤', error: error.message });
    }
  }

  // 創建外部連結（僅HR成員）
  async createLink(req, res) {
    try {
      // 檢查是否為HR成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以創建外部連結' });
      }

      const { name, narrative, logo_url, url, display_order, is_active } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({ message: '請輸入連結名稱' });
      }

      if (!url || url.trim() === '') {
        return res.status(400).json({ message: '請輸入連結URL' });
      }

      // 驗證 URL 格式
      try {
        new URL(url);
      } catch (e) {
        return res.status(400).json({ message: '請輸入有效的URL格式' });
      }

      // 驗證 logo_url 格式（如果提供）
      let validatedLogoUrl = null;
      if (logo_url && logo_url.trim()) {
        try {
          new URL(logo_url.trim());
          validatedLogoUrl = logo_url.trim();
        } catch (e) {
          return res.status(400).json({ message: '請輸入有效的Logo URL格式' });
        }
      }

      const linkData = {
        name: name.trim(),
        narrative: narrative ? narrative.trim() : null,
        logo_url: validatedLogoUrl,
        url: url.trim(),
        display_order: display_order !== undefined ? parseInt(display_order) : 0,
        is_active: is_active !== undefined ? (is_active === 'true' || is_active === true) : true,
        created_by_id: req.user.id
      };

      const link = await ExternalLink.create(linkData);

      res.status(201).json({
        message: '外部連結已創建',
        link
      });
    } catch (error) {
      console.error('Create external link error:', error);
      res.status(500).json({ message: '創建外部連結時發生錯誤', error: error.message });
    }
  }

  // 更新外部連結（僅HR成員）
  async updateLink(req, res) {
    try {
      // 檢查是否為HR成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以更新外部連結' });
      }

      const { id } = req.params;
      const link = await ExternalLink.findById(id);

      if (!link) {
        return res.status(404).json({ message: '外部連結不存在' });
      }

      const { name, narrative, logo_url, url, display_order, is_active } = req.body;
      const updateData = {};

      if (name !== undefined) {
        if (!name || name.trim() === '') {
          return res.status(400).json({ message: '連結名稱不能為空' });
        }
        updateData.name = name.trim();
      }

      if (narrative !== undefined) {
        updateData.narrative = narrative === null || narrative === '' ? null : narrative.trim();
      }

      if (logo_url !== undefined) {
        if (logo_url === null || logo_url === '') {
          updateData.logo_url = null;
        } else {
          const trimmedLogoUrl = logo_url.trim();
          // 如果提供了 logo_url，驗證其格式
          if (trimmedLogoUrl) {
            try {
              new URL(trimmedLogoUrl);
              updateData.logo_url = trimmedLogoUrl;
            } catch (e) {
              return res.status(400).json({ message: '請輸入有效的Logo URL格式' });
            }
          } else {
            updateData.logo_url = null;
          }
        }
      }

      if (url !== undefined) {
        if (!url || url.trim() === '') {
          return res.status(400).json({ message: '連結URL不能為空' });
        }
        // 驗證 URL 格式
        try {
          new URL(url);
        } catch (e) {
          return res.status(400).json({ message: '請輸入有效的URL格式' });
        }
        updateData.url = url.trim();
      }

      if (display_order !== undefined) {
        updateData.display_order = parseInt(display_order);
      }

      if (is_active !== undefined) {
        updateData.is_active = is_active === 'true' || is_active === true;
      }

      updateData.updated_by_id = req.user.id;

      const updatedLink = await ExternalLink.update(id, updateData);

      res.json({
        message: '外部連結已更新',
        link: updatedLink
      });
    } catch (error) {
      console.error('Update external link error:', error);
      res.status(500).json({ message: '更新外部連結時發生錯誤', error: error.message });
    }
  }

  // 刪除外部連結（僅HR成員）
  async deleteLink(req, res) {
    try {
      // 檢查是否為HR成員
      const isHRMember = await User.isHRMember(req.user.id);
      if (!isHRMember) {
        return res.status(403).json({ message: '只有HR Group成員可以刪除外部連結' });
      }

      const { id } = req.params;
      const link = await ExternalLink.findById(id);

      if (!link) {
        return res.status(404).json({ message: '外部連結不存在' });
      }

      await ExternalLink.delete(id);

      res.json({ message: '外部連結已刪除' });
    } catch (error) {
      console.error('Delete external link error:', error);
      res.status(500).json({ message: '刪除外部連結時發生錯誤', error: error.message });
    }
  }
}

module.exports = new ExternalLinkController();

