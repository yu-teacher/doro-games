import { describe, expect, it } from 'vitest';
import { hasDefaultNickname, normalizeUsername, validateNickname, validateUsername } from './profile';

describe('normalizeUsername', () => {
  it('앞뒤 공백과 앞의 @ 를 떼고 소문자로 만든다', () => {
    expect(normalizeUsername('  @Doro_Fan ')).toBe('doro_fan');
    expect(normalizeUsername('abc')).toBe('abc');
  });
});

describe('validateUsername', () => {
  it('영문 소문자·숫자·밑줄 3~30자만 허용한다', () => {
    expect(validateUsername('doro_01')).toBeNull();
    expect(validateUsername('@Doro_01')).toBeNull();
    expect(validateUsername('ab')).not.toBeNull();
    expect(validateUsername('a'.repeat(31))).not.toBeNull();
    expect(validateUsername('한글이름')).not.toBeNull();
    expect(validateUsername('has space')).not.toBeNull();
    expect(validateUsername('dash-name')).not.toBeNull();
  });
});

describe('validateNickname', () => {
  it('비어 있거나 20자를 넘으면 안내하고, 한글과 이모지는 글자 수로 센다', () => {
    expect(validateNickname('   ')).not.toBeNull();
    expect(validateNickname('도로 러너')).toBeNull();
    expect(validateNickname('가'.repeat(20))).toBeNull();
    expect(validateNickname('가'.repeat(21))).not.toBeNull();
    expect(validateNickname('🐷'.repeat(20))).toBeNull();
  });

  it('제어 문자는 허용하지 않는다', () => {
    expect(validateNickname('a\u0007b')).not.toBeNull();
  });
});

describe('hasDefaultNickname', () => {
  it('닉네임이 사용자명과 같으면 아직 정하지 않은 것이다', () => {
    const base = { id: '1', color: '#fff' };
    expect(hasDefaultNickname({ ...base, username: 'userabc123', nickname: 'userabc123' })).toBe(true);
    expect(hasDefaultNickname({ ...base, username: 'userabc123', nickname: '러너' })).toBe(false);
    expect(hasDefaultNickname(null)).toBe(false);
  });
});
