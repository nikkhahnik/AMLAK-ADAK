<?php
declare(strict_types=1);
// Shared-host counterpart of the Netlify intake function. Keep credentials in host environment, never Git.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
function reply(int $status, bool $ok): void {
    http_response_code($status);
    echo json_encode(['ok'=>$ok,'delivered'=>$ok], JSON_UNESCAPED_UNICODE);
    exit;
}
function normalized(string $s): string {
    return strtr($s, ['۰'=>'0','۱'=>'1','۲'=>'2','۳'=>'3','۴'=>'4','۵'=>'5','۶'=>'6','۷'=>'7','۸'=>'8','۹'=>'9','٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9']);
}
function capped($value, int $length): string {
    if (!is_scalar($value)) return '';
    $s=trim(str_replace(["\r","\n"],' ',(string)$value));
    if(function_exists('mb_substr')) return mb_substr($s,0,$length,'UTF-8');
    $chars=preg_split('//u',$s,-1,PREG_SPLIT_NO_EMPTY);
    return $chars===false?'':implode('',array_slice($chars,0,$length));
}
if (($_SERVER['REQUEST_METHOD']??'')!=='POST') reply(405,false);
if (stripos($_SERVER['CONTENT_TYPE']??'','application/json')!==0) reply(415,false);
if ((int)($_SERVER['CONTENT_LENGTH']??0)>16000) reply(413,false);
$raw=file_get_contents('php://input',false,null,0,16001);
if($raw===false || strlen($raw)>16000) reply(413,false);
$d=json_decode($raw,true);
if(!is_array($d) || !empty($d['company']) || ($d['consent']??'')!=='yes' || (int)($d['elapsed']??0)<2000) reply(400,false);
$kind=$d['kind']??'';
if(!in_array($kind,['darkhast','sabt'],true)) reply(400,false);
$name=capped($d[$kind==='sabt'?'name':'family']??'',80);
$phone=preg_replace('/[\s-]/u','',normalized(capped($d['phone']??'',20)));
if(!$name || !preg_match('/^09[0-9]{9}$/D',$phone??'') || !capped($d['deal']??'',30) || !capped($d['category']??'',30)) reply(400,false);
$token=getenv('TELEGRAM_BOT_TOKEN')?:'';
$chat=getenv('TELEGRAM_CHAT_ID')?:'';
if(!preg_match('/^[0-9]+:[A-Za-z0-9_-]+$/D',$token) || !preg_match('/^-?[0-9]+$/D',$chat) || !function_exists('curl_init')) reply(503,false);
// Best effort global throttle; fail closed if lock cannot be acquired. No lead details are logged.
$dir=sys_get_temp_dir().'/adak-intake-'.substr(hash('sha256',__DIR__),0,24);
if(!is_dir($dir) && !@mkdir($dir,0700,true) && !is_dir($dir)) reply(503,false);
if(is_link($dir)) reply(503,false);
$rate=$dir.'/rate.json';
if(is_link($rate)) reply(503,false);
$fp=@fopen($rate,'c+');
if(!$fp || !flock($fp,LOCK_EX)){if($fp)fclose($fp);reply(503,false);}
@chmod($rate,0600);
$times=json_decode(stream_get_contents($fp),true);if(!is_array($times))$times=[];
$now=time();$times=array_values(array_filter($times,function($t)use($now){return is_int($t)&&$t>$now-60;}));
if(count($times)>=20){flock($fp,LOCK_UN);fclose($fp);reply(429,false);}
$times[]=$now;ftruncate($fp,0);rewind($fp);fwrite($fp,json_encode($times));fflush($fp);flock($fp,LOCK_UN);fclose($fp);
$fields=['code'=>['کد پیگیری',40],'deal'=>['نوع معامله',30],'category'=>['نوع ملک',30],'city'=>['شهر',40],'area'=>['محله',80],'areas'=>['محدوده‌های موردنظر',160],'areaM2'=>['متراژ',10],'amin'=>['حداقل متراژ',10],'amax'=>['حداکثر متراژ',10],'beds'=>['خواب',10],'year'=>['سال ساخت',10],'floor'=>['طبقه',10],'deed'=>['نوع سند',30],'amenities'=>['امکانات',240],'price'=>['قیمت پیشنهادی',40],'bmin'=>['حداقل بودجه',40],'bmax'=>['حداکثر بودجه',40],'deposit'=>['ودیعه',40],'rent'=>['اجاره',40],'dmax'=>['حداکثر ودیعه',40],'rmax'=>['حداکثر اجاره',40],'phone2'=>['تلفن دیگر',20],'desc'=>['توضیحات',1200]];
$msg=($kind==='darkhast'?'درخواست ملک جدید':'ثبت ملک جدید')."\nنام: ".$name."\nشماره تماس: ".$phone;
foreach($fields as $k=>$spec){$v=capped($d[$k]??'',$spec[1]);if($v!=='')$msg.="\n".$spec[0].': '.$v;}
$ch=curl_init('https://api.telegram.org/bot'.$token.'/sendMessage');
if(!$ch) reply(503,false);
curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_RETURNTRANSFER=>true,CURLOPT_HTTPHEADER=>['Content-Type: application/json'],CURLOPT_POSTFIELDS=>json_encode(['chat_id'=>$chat,'text'=>$msg,'disable_web_page_preview'=>true],JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE),CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>10,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_FOLLOWLOCATION=>false]);
$result=curl_exec($ch);$http=curl_getinfo($ch,CURLINFO_HTTP_CODE);curl_close($ch);
$out=is_string($result)?json_decode($result,true):null;
reply($http===200 && is_array($out) && ($out['ok']??false)===true?200:503,$http===200 && is_array($out) && ($out['ok']??false)===true);
