const ExternalLink = require('../database/models/ExternalLink');
const User = require('../database/models/User');

// 驗證 URL 或 data URI 的輔助函數
function validateUrlOrDataUri(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    return false;
  }
  
  const trimmed = urlString.trim();
  
  // 檢查是否為 data URI（格式：data:[<mediatype>][;base64],<data>）
  if (trimmed.startsWith('data:')) {
    // 基本格式驗證：data: 後面應該有逗號和數據內容
    // 允許各種格式：data:image/jpeg;base64,xxx 或 data:text/plain,xxx 等
    return trimmed.length > 5 && trimmed.includes(',');
  }
  
  // 否則驗證為標準 URL
  try {
    new URL(trimmed);
    return true;
  } catch (e) {
    return false;
  }
}

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

      // 驗證 logo_url 格式（如果提供）- 支援標準 URL 或 data URI
      let validatedLogoUrl = null;
      if (logo_url && logo_url.trim()) {
        const trimmedLogoUrl = logo_url.trim();
        if (validateUrlOrDataUri(trimmedLogoUrl)) {
          validatedLogoUrl = trimmedLogoUrl;
        } else {
          return res.status(400).json({ message: '請輸入有效的Logo URL格式或data URI' });
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
          // 如果提供了 logo_url，驗證其格式 - 支援標準 URL 或 data URI
          if (trimmedLogoUrl) {
            if (validateUrlOrDataUri(trimmedLogoUrl)) {
              updateData.logo_url = trimmedLogoUrl;
            } else {
              return res.status(400).json({ message: '請輸入有效的Logo URL格式或data URI' });
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

