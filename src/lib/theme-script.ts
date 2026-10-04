export const THEME_KEY = "smart-attendance:theme";

/** Default theme is LIGHT; the user's choice is remembered. Runs before first paint (inlined in <head>) so there is no light/dark flash. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark"){t="light"}var d=document.documentElement;if(t==="dark")d.classList.add("dark");else d.classList.remove("dark");d.style.colorScheme=t}catch(e){}})();`;
