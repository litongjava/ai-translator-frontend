// authStore.ts
import {Mcid} from "./mcid.ts";

interface User {
  uid: string;
}

class AuthStore {
  private _user: User | null = null;
  private _token: string | null = null;

  constructor() {
    this.initialize();
  }

  /**
   * 初始化时从 localStorage 中读取 userId，
   * 如果没有，则生成一个新的 userId 并保存到 localStorage 中
   */
  private initialize() {
    // 尝试从 localStorage 获取 userId
    let userId = localStorage.getItem('userId');
    if (!userId) {
      // 使用 mcid 生成新的 userId
      userId = new Mcid().generate().toString();
      localStorage.setItem('userId', userId);
    }
    this._user = { uid: userId };

    // 如果需要管理 token，也可以从 localStorage 读取 token
    const token = localStorage.getItem('token');
    if (token) {
      this._token = token;
    }
  }

  /**
   * 获取当前用户信息
   */
  public get user(): User {
    return this._user as User;
  }

  /**
   * 获取当前 token（如果有）
   */
  public get token(): string | null {
    return this._token;
  }

  /**
   * 设置 token，并保存到 localStorage 中
   */
  public setToken(token: string) {
    this._token = token;
    localStorage.setItem('token', token);
  }
}

const authStore = new AuthStore();
export default authStore;
