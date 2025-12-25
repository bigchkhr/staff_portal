# PDF加密功能設置說明

## 概述

文件發放管理頁面支持對上傳的PDF文件進行加密。用戶可以選擇是否加密PDF，並設置自定義密碼。

## 系統要求

PDF加密功能需要安裝 **qpdf** 命令行工具。

## 安裝qpdf

### Windows

1. 訪問 [qpdf官方網站](https://qpdf.sourceforge.io/)
2. 下載Windows版本的qpdf
3. 解壓並將qpdf添加到系統PATH環境變數中
4. 或在項目中提供qpdf的可執行文件路徑

### Linux (Ubuntu/Debian)

使用 apt 包管理器安裝：

```bash
sudo apt-get update
sudo apt-get install qpdf
```

或者使用 apt（較新的版本）：

```bash
sudo apt update
sudo apt install qpdf
```

### Linux (CentOS/RHEL/Fedora)

對於 CentOS 7 和 RHEL 7：

```bash
sudo yum install qpdf
```

對於 CentOS 8+、RHEL 8+ 和 Fedora：

```bash
sudo dnf install qpdf
```

### Linux (其他發行版)

#### Arch Linux / Manjaro

```bash
sudo pacman -S qpdf
```

#### openSUSE

```bash
sudo zypper install qpdf
```

#### 從源代碼編譯（所有Linux發行版）

如果您的Linux發行版沒有qpdf包，可以從源代碼編譯：

```bash
# 安裝依賴
sudo apt-get install build-essential libjpeg-dev zlib1g-dev

# 下載源代碼
wget https://github.com/qpdf/qpdf/releases/download/v11.6.3/qpdf-11.6.3.tar.gz
tar -xzf qpdf-11.6.3.tar.gz
cd qpdf-11.6.3

# 編譯和安裝
./configure
make
sudo make install
```

注意：請訪問 [qpdf GitHub Releases](https://github.com/qpdf/qpdf/releases) 獲取最新版本號。

### macOS

```bash
brew install qpdf
```

## 驗證安裝

安裝完成後，在命令行中運行：

```bash
qpdf --version
```

如果顯示版本信息（例如：`qpdf version 11.6.3`），說明安裝成功。

### Linux 上驗證路徑

在Linux上，確保qpdf在系統PATH中：

```bash
which qpdf
```

應該顯示qpdf的完整路徑，例如：`/usr/bin/qpdf`

如果找不到qpdf，可能需要：

1. 檢查是否正確安裝
2. 檢查PATH環境變數
3. 重新登錄終端會話

## 功能說明

### 加密選項

- 當用戶上傳PDF文件時，可以選擇是否加密
- 如果選擇加密，需要輸入加密密碼
- 加密後的PDF文件需要輸入密碼才能打開

### 加密設置

- **加密強度**: 256位
- **用戶密碼**: 用戶自定義
- **所有者密碼**: 與用戶密碼相同
- **權限設置**:
  - 允許完整打印
  - 不允許修改
  - 不允許提取內容

## 故障排除

### 錯誤：qpdf not installed

如果上傳PDF時出現此錯誤，說明系統未安裝qpdf。請按照上述安裝步驟安裝qpdf。

### 錯誤：PDF加密失敗

如果加密過程中出現錯誤，請檢查：
1. qpdf是否正確安裝
2. PDF文件是否損壞
3. 服務器是否有足夠的磁盤空間
4. 文件路徑是否正確

## 注意事項

1. 加密密碼由用戶設置，系統不會存儲明文密碼（僅存儲在數據庫中用於標記）
2. 加密後的PDF文件大小可能會略有增加
3. 加密過程需要一些時間，大文件可能需要更長時間
4. 請確保qpdf版本為8.0或更高版本以支持256位加密

## 技術實現

系統使用qpdf命令行工具對PDF進行加密：

```bash
qpdf --encrypt <user-password> <owner-password> 256 --print=full --modify=none --extract=n -- <input> <output>
```

## 數據庫字段

PDF加密功能使用以下數據庫字段：
- `is_encrypted`: 布爾值，標記文件是否加密
- `encryption_password`: 字符串，存儲加密密碼（用於標記，實際加密在文件層面）

請確保已運行數據庫遷移 `026_add_pdf_encryption_to_employee_documents.js`。

