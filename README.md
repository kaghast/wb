# VektorDraw - Vektör & Diagram Beyaz Tahtası

Modern, minimalist ve yüksek performanslı vektör tabanlı diagram ve beyaz tahta uygulaması. Excalidraw sadeliği, Figma hizalama yetenekleri ve File System Access API ile yerel dosya sistemine doğrudan SVG kaydetme özelliklerini bir arada sunar.

---

## 🚀 Coolify ile 1-Tıkla Kolay Kurulum (Public GitHub Repo)

Bu proje Coolify'a doğrudan GitHub Public Reposu üzerinden tek tıkla deploy edilecek şekilde Docker ve Nginx ile optimize edilmiştir:

1. **Coolify Panelinize Giriş Yapın**:
   - `Projects` -> Projenizi seçin -> `New Resource` butonuna tıklayın.
2. **Public GitHub Repository Seçin**:
   - `Public Repository` seçeneğini seçip bu GitHub reposunun URL'ini yapıştırın.
3. **Build Pack**:
   - Coolify repodaki `Dockerfile` veya `docker-compose.yml` dosyasını otomatik olarak algılar (Build Pack: **Dockerfile**).
4. **Port Yapılandırması**:
   - Port olarak varsayılan **80** (veya docker-compose için **3000**) belirtmeniz yeterlidir.
5. **Deploy**:
   - `Deploy` butonuna basın! Çok aşamalı (multi-stage) Docker build otomatik olarak çalışacak ve Nginx SPA sunucusu üzerinde yayına alınacaktır.

---

## 🐳 Docker ile Yerel Çalıştırma

Projeyi yerel makinenizde Docker ile hemen çalıştırmak için:

```bash
# Docker Compose ile başlatma
docker compose up -d --build

# Tarayıcıda açın:
# http://localhost:3000
```

---

## 🛠️ Temel Özellikler

- **Vektör Çizim Araçları**: Seçim & Taşıma (V), Kaydırma/El (H / Space), Dikdörtgen (R), Yuvarlak Kutu (U), Daire/Elips (O), Eşkenar Dörtgen/Karar (D), Ok Bağlantısı (A), Düz Çizgi (L), Serbest Kalem (P), Zengin Metin (T), Silgi (E).
- **Hizalama ve Dağıtma Araçları**: Sola, Ortaya, Sağa, Üste, Dikey Ortaya, Alta Hizalama; Yatay ve Dikey Eşit Dağıtma.
- **Yerel Dosya Sistemi (File System Access API)**:
  - Dosyaları doğrudan bilgisayarınızdaki proje dizinine `.svg` olarak kaydeder (`showSaveFilePicker`).
  - Açılan veya kaydedilen SVG dosyalarının içine Fabric.js durumu gömüldüğünden, dosya tekrar açıldığında %100 düzenlenebilir olarak yüklenir.
- **Son 5 Doküman Hızlı Menüsü**: Dosya menüsünden son çalışılan 5 dokümana önizleme görselleriyle tek tıkla anında erişim.
- **Dinamik Katman Yönetimi (Layers)**:
  - Canvas nesnelerinin dinamik hiyerarşik listesi.
  - Sürükle ve bırak ile katman sırasını (Z-Index) anlık değiştirme.
  - Görünürlük (Eye) ve Kilitleme (Padlock) anahtarları.
  - Katman adını yeniden adlandırma.
- **Sürükle ve Bırak (Drag & Drop)**:
  - Sol şablon paletinden bileşenleri canvas'a sürükleme.
  - Masaüstünden SVG veya PNG/JPG görsellerini tuvale bırakma.
- **Otomatik Yedekleme (Auto-Backup)**:
  - Yapılan değişiklikler otomatik olarak arka planda yedeklenir.
  - Canlı durum göstergesi ile veri kaybı riski ortadan kalkar.
- **Dışa Aktarma Seçenekleri**:
  - **Copy to HTML (SVG)**: Oluşan SVG kodunu tek tıkla panoya kopyalama.
  - **SVG Vektör**: Standart ölçeklenebilir SVG dosyası.
  - **PNG Görsel**: 2x Retina yüksek çözünürlüklü raster görsel.
  - **PDF Doküman**: Yüksek kaliteli vektör/sayfa PDF çıktısı.
- **Çevrimdışı Çalışma (PWA)**:
  - Service Worker ve Web App Manifest ile internetsiz ortamda eksiksiz çalışabilirlik.
  - Masaüstü ve iOS/Android için tek tıkla uygulama kurulumu.
