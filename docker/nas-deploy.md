# BIM-Vortex Synology NAS 배포 가이드

## 사전 준비

1. **Synology NAS** (Docker 지원 모델: DS220+, DS920+, DS1621+ 등)
2. **Container Manager** 패키지 설치 (패키지 센터)
3. **공유기 포트포워딩**: 80, 443 → NAS IP

## 배포 순서

### 1. NAS에 폴더 생성

SSH 또는 File Station에서:
```bash
mkdir -p /volume1/docker/bim-vortex/uploads
mkdir -p /volume1/docker/bim-vortex/data
mkdir -p /volume1/docker/bim-vortex/outputs
```

### 2. 프로젝트 업로드

Git 저장소를 NAS에 클론하거나, 파일을 업로드:
```bash
cd /volume1/docker
git clone <your-repo-url> bim-vortex-app
```

### 3. Docker Compose 실행

```bash
cd /volume1/docker/bim-vortex-app/docker
docker-compose -f docker-compose.nas.yml up -d --build
```

### 4. 외부 접근 설정

#### 방법 A: Synology DDNS (무료, 가장 쉬움)
1. DSM → 제어판 → 외부 액세스 → DDNS
2. Synology 제공 DDNS 등록 (예: `bim-vortex.synology.me`)
3. 제어판 → 로그인 포털 → 역방향 프록시:
   - `https://bim-vortex.synology.me` → `http://localhost:3000`
   - `https://bim-vortex.synology.me/api` → `http://localhost:8000`

#### 방법 B: 개인 도메인
1. 도메인 DNS에서 A 레코드 → NAS 공인 IP
2. DSM → 보안 → 인증서 → Let's Encrypt 발급
3. 역방향 프록시 설정 동일

### 5. SSL 인증서 (HTTPS)

DSM → 제어판 → 보안 → 인증서:
- "추가" → Let's Encrypt → 도메인 입력
- 자동 갱신됨 (90일마다)

## 클라우드 스토리지 연동

### Synology Drive (NAS 자체 클라우드)
- 업로드된 파일을 Synology Drive로 자동 동기화
- 외부에서 Synology Drive Client로 파일 접근 가능
- `/volume1/docker/bim-vortex/uploads`를 Drive 공유 폴더로 설정

### 접근 URL
- 웹앱: `https://bim-vortex.synology.me`
- API: `https://bim-vortex.synology.me/api/v1`
- 파일: Synology Drive 앱으로 동기화

## 유지보수

```bash
# 로그 확인
docker logs bim-vortex-backend
docker logs bim-vortex-frontend

# 업데이트
cd /volume1/docker/bim-vortex-app
git pull
docker-compose -f docker/docker-compose.nas.yml up -d --build

# 백업 (NAS Hyper Backup 활용)
# /volume1/docker/bim-vortex/ 폴더를 백업 대상에 추가
```

## 리소스 요구사항

| 항목 | 최소 | 권장 |
|------|------|------|
| RAM | 2GB | 4GB+ |
| CPU | 2코어 | 4코어 |
| 디스크 | 10GB | 50GB+ |
| 네트워크 | 10Mbps↑ | 100Mbps↑ |
