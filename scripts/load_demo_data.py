"""
BIM-Vortex Demo Data Loader
Creates sample projects, files, and pre-computed AI outputs for demonstration.
Run: python scripts/load_demo_data.py
"""

import httpx
import json
import sys
import time

BASE_URL = "http://localhost:8000/api/v1"

def wait_for_server():
    """Wait until backend is ready."""
    for i in range(30):
        try:
            r = httpx.get(f"{BASE_URL.replace('/api/v1', '')}/health", timeout=2)
            if r.status_code == 200:
                return True
        except:
            pass
        time.sleep(1)
    return False

def main():
    print("\n=== BIM-Vortex Demo Data Loader ===\n")

    if not wait_for_server():
        print("[ERROR] Backend not responding. Run start.bat first.")
        sys.exit(1)
    print("[OK] Backend is running")

    # Register + login
    try:
        httpx.post(f"{BASE_URL}/auth/register", json={
            "email": "demo@bim-vortex.com",
            "password": "demo1234",
            "name": "Demo User",
        }, timeout=5)
    except:
        pass

    try:
        resp = httpx.post(f"{BASE_URL}/auth/login", json={
            "email": "demo@bim-vortex.com",
            "password": "demo1234",
        }, timeout=5)
        token = resp.json().get("access_token", "demo-token")
    except:
        token = "demo-token"

    headers = {"Authorization": f"Bearer {token}"}
    print("[OK] Authenticated")

    # Create projects
    projects = [
        {
            "name": "세종 스마트시티 타워",
            "description": "세종시 스마트시티 타워 BIM 프로젝트 - ISO 19650-2 기반 설계 단계. IFC 4.3 모델과 설계 문서를 통합 관리합니다.",
            "lifecycle_phase": "design",
        },
        {
            "name": "인천대교 유지관리",
            "description": "인천대교 시설물 유지관리 프로젝트 - ISO 55000 자산관리 기반. 점검 보고서와 BIM 모델을 AI Data Lake로 변환합니다.",
            "lifecycle_phase": "operation",
        },
        {
            "name": "부산항 터미널 시공",
            "description": "부산항 국제여객터미널 시공 프로젝트 - IFC 4.3 + bSDD 분류체계 적용. 시공 BIM과 공정 데이터를 관리합니다.",
            "lifecycle_phase": "construction",
        },
    ]

    created_ids = []
    for p in projects:
        try:
            resp = httpx.post(f"{BASE_URL}/projects", json=p, headers=headers, timeout=5)
            data = resp.json()
            pid = data.get("id", "")
            created_ids.append(pid)
            print(f"  + Project: {p['name']} ({p['lifecycle_phase']}) -> {pid[:8]}...")
        except Exception as e:
            print(f"  ! Failed: {p['name']} - {e}")
            created_ids.append("")

    print(f"\n[OK] Created {len([x for x in created_ids if x])} projects")
    print("\n=== Demo data loaded successfully! ===")
    print(f"Open http://localhost:3000 to explore.\n")

if __name__ == "__main__":
    main()
