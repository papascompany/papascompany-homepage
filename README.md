# PapasCompany Homepage

파파스컴퍼니 공식 홈페이지 (papascompany.co.kr).

## 구성

정적 HTML 1개 (`index.html`) — 외부 의존:
- Pretendard Variable (jsdelivr CDN)
- Placeholder 이미지 (picsum.photos · 운영 전 실제 이미지로 교체 예정)

## 배포

GitHub master 브랜치 push 시 Vercel이 자동 배포.

| 환경 | URL |
|---|---|
| Production | https://papascompany.co.kr |
| Production (Vercel 기본) | https://papascompany-homepage.vercel.app |

## 로컬 미리보기

```bash
python3 -m http.server 8000
# 또는
npx serve .
```

`http://localhost:8000` 접속.

## 도메인 DNS

- 등록사: 가비아
- 네임서버: DNSever
- A 레코드:
  - `@` → 76.76.21.21 (Vercel)
  - `www` → 76.76.21.21 (Vercel)
