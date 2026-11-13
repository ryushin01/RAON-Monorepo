// entities/episode가 쓰는 세션 API(FSD 교차 import). 유료 회차 이미지를 전달할 때 로그인 정보를 붙인다. 원본이 server-only라 서버에서만 쓸 수 있다.
export { getSessionToken } from "../api/session";
