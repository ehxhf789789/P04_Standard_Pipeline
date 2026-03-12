# BIM-to-AI Pipeline 배포 가이드

## 목차
1. [로컬 개발 환경 실행](#1-로컬-개발-환경-실행)
2. [Docker 개발 환경](#2-docker-개발-환경)
3. [프로덕션 배포](#3-프로덕션-배포)
4. [클라우드 배포 옵션](#4-클라우드-배포-옵션)

---

## 1. 로컬 개발 환경 실행

### 필수 요구사항
- Python 3.11+
- Node.js 20+
- pnpm (`npm install -g pnpm`)

### 백엔드 실행
```bash
cd apps/backend

# 가상환경 생성 및 활성화
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate

# 의존성 설치
pip install -e .

# 서버 실행
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

### 프론트엔드 실행
```bash
cd apps/frontend

# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm dev
```

### 접속
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API 문서: http://localhost:8000/docs

---

## 2. Docker 개발 환경

### 필수 요구사항
- Docker Desktop 또는 Docker Engine
- Docker Compose v2+

### 실행 방법
```bash
cd docker

# 모든 서비스 시작
docker-compose up -d

# 로그 확인
docker-compose logs -f

# 서비스 중지
docker-compose down
```

### 서비스 구성
| 서비스 | 포트 | 설명 |
|--------|------|------|
| frontend | 3000 | Next.js 웹 앱 |
| backend | 8000 | FastAPI 서버 |
| db | 5432 | PostgreSQL 16 |
| redis | 6379 | Celery 브로커 |
| minio | 9000/9001 | S3 호환 스토리지 |
| celery-worker | - | 백그라운드 작업 |

---

## 3. 프로덕션 배포

### 3.1 환경 변수 설정

```bash
cd docker

# 환경 변수 파일 생성
cp .env.example .env

# .env 파일 편집
nano .env
```

**필수 설정 항목:**
```env
# 데이터베이스
DB_USER=bim_user
DB_PASSWORD=안전한-비밀번호-설정
DB_NAME=bim_pipeline

# Redis
REDIS_PASSWORD=redis-비밀번호-설정

# MinIO
MINIO_ACCESS_KEY=minio-access-key
MINIO_SECRET_KEY=minio-secret-key

# JWT 비밀키 (필수! 아래 명령으로 생성)
# openssl rand -hex 32
SECRET_KEY=생성된-32바이트-키

# 도메인 설정
API_URL=https://api.your-domain.com
WS_URL=wss://api.your-domain.com
CORS_ORIGINS=["https://your-domain.com"]
```

### 3.2 Nginx 설정

```bash
mkdir -p docker/nginx

cat > docker/nginx/nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream frontend {
        server frontend:3000;
    }

    upstream backend {
        server backend:8000;
    }

    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }

        # Backend API
        location /api/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket
        location /ws/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_read_timeout 86400;
        }
    }
}
EOF
```

### 3.3 SSL 인증서 설정

```bash
# Let's Encrypt 인증서 발급 (certbot 사용)
sudo certbot certonly --standalone -d your-domain.com -d api.your-domain.com

# 인증서 복사
mkdir -p docker/nginx/ssl
cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/nginx/ssl/
cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/nginx/ssl/
```

### 3.4 프로덕션 실행

```bash
cd docker

# 프로덕션 빌드 및 실행
docker-compose -f docker-compose.prod.yml up -d --build

# 상태 확인
docker-compose -f docker-compose.prod.yml ps

# 로그 확인
docker-compose -f docker-compose.prod.yml logs -f backend
```

---

## 4. 클라우드 배포 옵션

### 4.1 AWS (권장)

**아키텍처:**
```
                    ┌─────────────┐
                    │   Route53   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │     ALB     │
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           │               │               │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌──────▼──────┐
    │  ECS/EKS    │ │  ECS/EKS    │ │  ECS/EKS    │
    │  Frontend   │ │  Backend    │ │   Worker    │
    └─────────────┘ └──────┬──────┘ └──────┬──────┘
                           │               │
              ┌────────────┼───────────────┤
              │            │               │
       ┌──────▼──────┐ ┌───▼───┐ ┌─────────▼─────────┐
       │    RDS      │ │ElastiC│ │        S3         │
       │ PostgreSQL  │ │ Cache │ │   (File Storage)  │
       └─────────────┘ └───────┘ └───────────────────┘
```

**배포 순서:**
1. VPC 및 서브넷 구성
2. RDS PostgreSQL 인스턴스 생성
3. ElastiCache Redis 클러스터 생성
4. S3 버킷 생성 (MinIO 대체)
5. ECR에 Docker 이미지 푸시
6. ECS/EKS 클러스터에 서비스 배포
7. ALB 설정 및 Route53 연결

**예상 비용 (월간):**
| 서비스 | 사양 | 비용 |
|--------|------|------|
| ECS (Fargate) | 2 vCPU, 4GB x 3 | ~$150 |
| RDS PostgreSQL | db.t3.medium | ~$50 |
| ElastiCache | cache.t3.micro | ~$15 |
| S3 | 100GB | ~$3 |
| ALB | - | ~$20 |
| **합계** | | **~$240** |

### 4.2 GCP

**서비스 매핑:**
- ECS → Cloud Run
- RDS → Cloud SQL
- ElastiCache → Memorystore
- S3 → Cloud Storage
- ALB → Cloud Load Balancing

### 4.3 Azure

**서비스 매핑:**
- ECS → Azure Container Apps
- RDS → Azure Database for PostgreSQL
- ElastiCache → Azure Cache for Redis
- S3 → Azure Blob Storage
- ALB → Azure Application Gateway

### 4.4 간단한 VPS 배포 (시연용 권장)

**추천 서비스:** DigitalOcean, Vultr, Linode

```bash
# 1. VPS 생성 (Ubuntu 22.04, 4GB RAM 이상)

# 2. Docker 설치
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 3. 프로젝트 클론
git clone https://github.com/your-repo/bim-to-ai-pipeline.git
cd bim-to-ai-pipeline

# 4. 환경 변수 설정
cp docker/.env.example docker/.env
nano docker/.env

# 5. 실행
cd docker
docker-compose -f docker-compose.prod.yml up -d
```

**예상 비용 (월간):**
| 제공업체 | 사양 | 비용 |
|----------|------|------|
| DigitalOcean | 4GB RAM, 2 vCPU | $24 |
| Vultr | 4GB RAM, 2 vCPU | $20 |
| Linode | 4GB RAM, 2 vCPU | $24 |

---

## 5. 시연용 빠른 배포 (ngrok 사용)

로컬에서 바로 외부에 공개하려면:

```bash
# 1. ngrok 설치
# https://ngrok.com/download

# 2. 로컬 서비스 실행
cd docker
docker-compose up -d

# 3. ngrok으로 터널링
ngrok http 3000  # Frontend

# 별도 터미널에서
ngrok http 8000  # Backend API
```

**주의:** ngrok 무료 버전은 세션당 URL이 변경됨

---

## 6. 문제 해결

### 컨테이너 로그 확인
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

### 데이터베이스 접속
```bash
docker exec -it bim-pipeline-db psql -U bim_user -d bim_pipeline
```

### 컨테이너 재시작
```bash
docker-compose restart backend
```

### 전체 초기화
```bash
docker-compose down -v  # 볼륨 포함 삭제
docker-compose up -d --build
```

---

## 7. 보안 체크리스트

- [ ] 모든 기본 비밀번호 변경
- [ ] SECRET_KEY 랜덤 생성
- [ ] HTTPS 인증서 설정
- [ ] 방화벽 설정 (80, 443 포트만 개방)
- [ ] 정기 백업 설정
- [ ] 모니터링 설정 (선택)
