class WebhookController {
  async handleS3Upload(req, res) {
    try {
      const { bucket, filename } = req.body;

      // 驗證必要欄位
      if (!bucket || !filename) {
        return res.status(400).json({ 
          message: '缺少必要欄位',
          error: 'bucket 和 filename 為必填欄位' 
        });
      }

      // 輸出到 console
      console.log(`[S3 Webhook] File uploaded: ${filename}`);
      console.log(`[S3 Webhook] Bucket: ${bucket}`);

      // 回傳成功回應
      res.status(200).json({ message: 'Webhook received' });
    } catch (error) {
      console.error('❌ S3 Webhook error:', error);
      console.error('Error stack:', error.stack);
      
      res.status(500).json({ 
        message: '處理 Webhook 時發生錯誤',
        error: error.message 
      });
    }
  }
}

module.exports = new WebhookController();

