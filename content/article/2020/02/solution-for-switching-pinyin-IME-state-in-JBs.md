---
title: Solution for switching between lowercase and Chinese pinyin with Caps Lock in Jetbrains IDEs
date: '2020-02-12'
categories: 
    - Configuration
---
TL;DR:

Add `TICapsLockLanguageSwitchCapable - true` to your input method's Info.plist[1]

## Background

Last month I encountered a problem with Chinese input method (Rime, Baidu, Sogou, etc), the symptoms is that I couldn't switch between pinyin and lowercase letters with the Caps Lock which can pressed by my little finger in Jetbrains IDEs, which has been my habit since I used macOS.

Before using third-party input methods, it works well with apple pinyin method. But the restriction of it drives me to seek any other IMEs. Rime is a good choice which fits the need of programmers but something of cloud is one of the shortcomings. But none of these is a obstacle except the defect that switching between English and Chinese. My Rime's configuration is something like:

```yaml
patch:
  ascii_composer/good_old_caps_lock: false
  ascii_composer/switch_key:
    Caps_Lock: commit_code
    Shift_L: noop
    Shift_R: noop
    Control_L: noop
    Control_R: noop
```

as what I said above, it doesn't work in any of Jetbrains IDEs. Unfortunately, as long as it is a Chinese input method, then it won't work.

## A Solution? Maybe

There are some solutions that not solve the situation fundamentally.

- use shift to switch the state of IME.
- use other software to modify the Caps Lock key map.

You will be very disappointed if you get such solutions after a hard searching. Yes, that's not my solution.

## Follow my step

Of course I should ask Jetbrains for help, but after searching in the issue tracker they seems not practiced in solve Chinese IME problems. Swtiching Java runtime does totally not work.

In fact, apple IME do switch by changing from ABC to Chinese pinyin (2 IMEs). But Baidu or Sogou provides a drop-down bar for selecting the switch key to change its state and, I can start from this.

After macOS 10.15, there is a public interface enables the Caps Lock key to switch between Latin and non-Latin input sources[1]. So wo can add this into my IME which have not added it.

There is a feasible method by terminal:

```bash
cd /Library/Input Methods/[YOUR IME.app]/Contents && sudo /usr/libexec/PlistBuddy -c 'Add :TICapsLockLanguageSwitchCapable bool true' Info.plist
```

You can verify it with

```bash
/usr/libexec/PlistBuddy -c 'print' Info.plist | grep TICapsLockLanguageSwitchCapable
```

which will return `true`.

Or you can edit it with a plist editor directly.

---

[1] https://developer.apple.com/documentation/bundleresources/information_property_list/ticapslocklanguageswitchcapable?language=objc