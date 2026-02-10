# STACKS 📈

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **STACKS**는 주식 시뮬레이션에 특화된 웹 기반 게임 플랫폼입니다.  
> 가상의 주식 시장에서 투자 감각을 시험하고, 다른 사용자들과 실시간으로 경쟁하세요.

---

## 🚀 소개

**STACKS**는 실제 주식 거래를 모방한 시뮬레이션 게임으로,  
가상 자금을 활용해 포트폴리오를 구성하고, 시장 변동에 대응하며 투자 역량을 키울 수 있는  
주식 시뮬레이션 플랫폼입니다.  
**STACKS에서 당신만의 투자 전략을 세워보세요.**

---

## 주요 기능

### 📈 주식 시뮬레이션
- **실시간 주가 모니터링**: 글로벌 주식시장을 실시간으로 확인
- **포트폴리오 관리 및 성과 분석**: 투자 성과를 직관적으로 분석
- **실시간 뉴스 피드**: 시장 변동에 영향을 주는 최신 뉴스 제공
- **투자 성과 트래킹**: 당신의 투자 여정을 체계적으로 기록

### 🎯 대시보드 시스템
- **개인화 대시보드**: 사용자 맞춤형 인터페이스로 중요한 정보를 한눈에
- **포인트 시스템**: 주식 시뮬레이션을 통해 포인트 획득
- **친구 관리**: 친구들과 실시간으로 소통하며 경쟁
- **리더보드**: 전체 사용자 랭킹 확인

### 📚 가이드 시스템
- **섹션별 구조화된 가이드**: 초보자도 쉽게 따라할 수 있는 단계별 가이드
- **마크다운 기반 콘텐츠**: 누구나 이해하기 쉬운 문서화
- **실시간 업데이트**: 최신 정보를 항상 제공

---

## 스크린샷

> **스크린샷**: 서비스 런칭 시, 당신의 눈을 사로잡을 최신 인터페이스를 만나보세요!  
> *(현재 준비 중)*

---

## 기술 스택

![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)

---

## 시스템 아키텍처

- **인증 시스템**: [Supabase Auth](https://supabase.com/docs/guides/auth)
- **데이터베이스**: [Supabase PostgreSQL](https://supabase.com/docs/guides/database)
- **실시간 처리**: [Supabase Realtime](https://supabase.com/docs/guides/realtime)
- **스케줄러**: 자체 개발 마켓 스케줄러
- **캐싱 레이어**: [Redis (Upstash)](https://upstash.com/)

---

## 시작하기

### 1️⃣ 저장소 클론
```bash
git clone [repository-url]
```

### 2️⃣ 의존성 설치
```bash
npm install
```

### 3️⃣ 환경 변수 설정
```bash
cp .env.example .env.local
```

### 4️⃣ 개발 서버 실행
```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)를 열어 결과를 확인하세요.

## 환경 변수 설정
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_APP_URL=your_app_url
```

## 코드 구조

```
📦src
 ┣ 📂app
 ┃ ┣ 📂dashboard
 ┃ ┗ 📂api
 ┣ 📂components
 ┣ 📂lib
 ┣ 📂services
 ┣ 📂hooks
 ┗ 📂types
```

## 기여 방법

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 라이선스

이 프로젝트는 MIT 라이선스 하에 있습니다. 자세한 내용은 [LICENSE](LICENSE) 파일을 참고하세요.

## 연락처

프로젝트 관리자 - [ZENMA](https://github.com/Jaemnie)

---

## 문의

질문이나 문의 사항이 있으면, [issues](https://github.com/yourusername/stacks/issues) 섹션에 남겨주세요.
