---
style: ste80
lang: vi
---

# Đưa MONSPORT lên Google Cloud

Tài liệu này đưa bản trên `main` lên Google Cloud để chạy thử. Một dịch vụ Cloud Run chạy cả API và trang web. Cloud SQL chạy PostgreSQL 18. Secret Manager giữ chuỗi kết nối và khóa phiên. Lý do chọn cách này nằm ở `docs/adr/0003-google-cloud-run-cloud-sql.md`.

Chạy các lệnh trong PowerShell, tại `D:\MON-Sport`, trên nhánh `main`. Thay `<...>` bằng giá trị của bạn.

## 1. Cài gcloud và đăng nhập

1. Cài Google Cloud CLI: `winget install --id Google.CloudSDK --exact`. Một cách khác là chạy bộ cài `https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe`.
2. Mở một cửa sổ PowerShell mới.
3. Chạy `gcloud init`. Đăng nhập bằng tài khoản Google của bạn.

## 2. Tạo project và bật billing

```powershell
$Project = "monsport-<chuỗi riêng>"
$Region = "asia-southeast1"
gcloud projects create $Project
gcloud config set project $Project
```

Mở `https://console.cloud.google.com/billing/linkedaccount?project=<project>` và gắn một tài khoản billing. Các bước sau cần billing.

Tạo một ngân sách có cảnh báo tại `Billing > Budgets & alerts`, ví dụ 10 USD mỗi tháng. Cloud SQL tính tiền theo giờ, kể cả khi không ai dùng.

## 3. Bật các API

```powershell
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com sqladmin.googleapis.com secretmanager.googleapis.com
```

## 4. Tạo cơ sở dữ liệu

PostgreSQL 16 trở lên mặc định dùng bản Enterprise Plus, vốn đắt. Ghi rõ `--edition=ENTERPRISE` và hạng máy nhỏ nhất.

```powershell
gcloud sql instances create monsport-db --database-version=POSTGRES_18 --edition=ENTERPRISE --tier=db-f1-micro --region=$Region --storage-size=10 --storage-auto-increase
gcloud sql databases create monsport --instance=monsport-db
$DbPass = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
gcloud sql users create monsport --instance=monsport-db --password=$DbPass
$Conn = gcloud sql instances describe monsport-db --format="value(connectionName)"
```

Nếu `db-f1-micro` bị từ chối, thay `--tier=db-f1-micro` bằng `--cpu=1 --memory=3840MB`.

Lần migrate đầu tạo extension `btree_gist`. Người dùng do `gcloud sql users create` tạo có quyền làm việc này.

## 5. Lưu hai bí mật

```powershell
$Tmp = New-TemporaryFile
Set-Content -Path $Tmp -NoNewline -Value "postgresql://monsport:$DbPass@localhost/monsport?host=/cloudsql/$Conn"
gcloud secrets create monsport-database-url --data-file=$Tmp
$Session = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
Set-Content -Path $Tmp -NoNewline -Value $Session
gcloud secrets create monsport-session-secret --data-file=$Tmp
Remove-Item $Tmp
```

Không dán hai giá trị này vào chat, issue, hay commit.

## 6. Cấp quyền cho tài khoản dịch vụ

Cloud Run và Cloud Build dùng tài khoản dịch vụ Compute Engine mặc định.

```powershell
$Sa = "$(gcloud projects describe $Project --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
foreach ($Role in "roles/cloudsql.client", "roles/secretmanager.secretAccessor", "roles/run.builder") {
  gcloud projects add-iam-policy-binding $Project --member="serviceAccount:$Sa" --role=$Role
}
```

## 7. Deploy

```powershell
gcloud run deploy monsport --source . --region=$Region --allow-unauthenticated --add-cloudsql-instances=$Conn --update-secrets="DATABASE_URL=monsport-database-url:latest,SESSION_SECRET=monsport-session-secret:latest" --memory=512Mi --max-instances=2
```

Cloud Build dựng image từ `Dockerfile`. Mỗi lần container khởi động, nó chạy `prisma migrate deploy` trước khi chạy server. Lệnh in ra một URL dạng `https://monsport-....run.app`.

Kiểm tra:

```powershell
curl.exe https://<url>/api/health
```

Kết quả đúng là `{"status":"ok","db":"up"}`. Mở URL trên điện thoại để xem trang web.

## 8. Thêm dữ liệu mẫu (tùy chọn)

App chưa có màn hình đăng ký (UC-1) và quản lý đơn vị (UC-10). Để thử app, nạp dữ liệu mẫu: 6 tài khoản và 3 đơn vị.

Lệnh seed xóa hết dữ liệu trong các bảng. Chỉ chạy nó trước khi có dữ liệu thật.

1. Mở PowerShell tại `D:\MON-Sport`. Lấy lại tên kết nối và mật khẩu, vì một cửa sổ mới không còn các biến của bước 4:

```powershell
$Conn = gcloud sql instances describe monsport-db --format="value(connectionName)"
$DbPass = ((gcloud secrets versions access latest --secret=monsport-database-url) -split "[:@]")[2]
```

2. Tải Cloud SQL Auth Proxy: `https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.26.2/cloud-sql-proxy.x64.exe`. Đổi tên file thành `cloud-sql-proxy.exe`.
3. Chạy `gcloud auth application-default login`.
4. Trong một cửa sổ khác, chạy `.\cloud-sql-proxy.exe --port 5433 <connection name>`. Lấy `<connection name>` từ biến `$Conn`.
5. Trong cửa sổ có `$DbPass`, đặt một mật khẩu riêng cho các tài khoản mẫu, rồi chạy seed:

```powershell
$env:DATABASE_URL = "postgresql://monsport:$DbPass@localhost:5433/monsport"
$env:SEED_PASSWORD = "<mật khẩu riêng, không dùng monsport123>"
pnpm --filter @monsport/api db:seed
Remove-Item Env:DATABASE_URL, Env:SEED_PASSWORD
```

Các số điện thoại mẫu nằm trong `apps/api/prisma/seed.ts`. Ai có URL và mật khẩu mẫu thì đăng nhập được. Vì vậy, đừng dùng `monsport123` trên bản cloud.

## 9. Tự deploy từ main

Mỗi lần một pull request merge vào `main`, job `.github/workflows/deploy.yml` deploy bản mới lên Cloud Run. Sau đó job gọi `/api/health`. GitHub không giữ key nào. Google Cloud tin nhánh `main` của repo qua Workload Identity Federation.

Phần cài đặt đã làm ngày 17/10/2026:

- Tài khoản dịch vụ `monsport-deployer` có 3 role: `roles/run.sourceDeveloper`, `roles/serviceusage.serviceUsageConsumer`, `roles/logging.viewer`. Nó có `roles/iam.serviceAccountUser` trên tài khoản Compute mặc định.
- Pool `github`, provider `monsport-repo`. Provider chỉ nhận token của `Tlerd/MON-Sport` trên `refs/heads/main`.
- Hai biến của repo: `GCP_WIF_PROVIDER` và `GCP_DEPLOY_SA`.

Để deploy lại bằng tay, mở tab Actions, chọn `deploy`, rồi bấm `Run workflow`.

## 10. Xem log, dừng
- Xem log: `gcloud run services logs read monsport --region=$Region --limit=50`.
- Cloud Run không tính tiền khi không có request. Cloud SQL tính tiền theo giờ. Để ngừng trả tiền khi không dùng, chạy `gcloud sql instances patch monsport-db --activation-policy=NEVER`. Chạy lại với `ALWAYS` để bật lại. Dung lượng lưu trữ và bản sao lưu vẫn tính tiền khi instance dừng.

Lệnh `gcloud sql instances delete monsport-db` xóa cơ sở dữ liệu vĩnh viễn, kể cả bản sao lưu. Chỉ chạy lệnh này khi bạn bỏ hẳn bản cloud.

## Nguồn

- Cloud SQL, các phiên bản PostgreSQL: https://docs.cloud.google.com/sql/docs/postgres/db-versions
- Cloud SQL, tạo instance: https://docs.cloud.google.com/sql/docs/postgres/create-instance
- Cloud Run nối với Cloud SQL: https://docs.cloud.google.com/sql/docs/postgres/connect-run
- Cloud Run, bí mật: https://docs.cloud.google.com/run/docs/configuring/services/secrets
- Cloud Run, deploy từ mã nguồn: https://docs.cloud.google.com/run/docs/deploying-source-code
- Cloud SQL Auth Proxy: https://docs.cloud.google.com/sql/docs/postgres/connect-auth-proxy
- Bảng giá: https://cloud.google.com/sql/pricing và https://cloud.google.com/run/pricing
